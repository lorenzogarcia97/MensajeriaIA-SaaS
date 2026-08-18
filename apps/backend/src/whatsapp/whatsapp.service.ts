import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CryptoService } from '../common/crypto/crypto.service';
import { ClaudeService, ToolDefinition, ToolExecutor } from '../ai/claude.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { IntegrationsService } from '../integrations/integrations.service';

interface ParsedMessage {
  phoneNumberId: string;
  fromWaId: string;
  contactName: string | null;
  text: string;
  wamid: string;
}

interface SavedMessageResult {
  tenantId: string;
  tenantName: string;
  accessToken: string | null;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly GRAPH_API_VERSION = 'v23.0';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cryptoService: CryptoService,
    private readonly claudeService: ClaudeService,
    private readonly knowledgeService: KnowledgeService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async processIncomingWebhook(payload: unknown): Promise<void> {
    const parsed = this.parseIncomingMessage(payload);
    if (!parsed) {
      this.logger.warn(
        'Webhook sin un mensaje de texto reconocible -- se ignora (no es un error).',
      );
      return;
    }

    const result = await this.saveIncomingMessage(parsed);
    if (!result) {
      return;
    }

    const { tenantId, tenantName, accessToken } = result;

    if (!accessToken) {
      this.logger.warn(
        'No hay un token de acceso valido guardado para este numero -- no se puede responder.',
      );
      return;
    }

    // A partir de aca, cualquier error se deja propagar -- fallos reales
    // (Claude, Voyage, red, Meta, DB) que la cola debe reintentar.
    const tools: ToolDefinition[] = [
      this.knowledgeService.getToolDefinition(),
      ...(await this.integrationsService.listActiveTools(tenantId)),
    ];

    const executeTool: ToolExecutor = async (toolName, toolInput) => {
      if (toolName === 'search_knowledge_base') {
        const query = toolInput.query as string;
        const results = await this.knowledgeService.searchKnowledgeBase(tenantId, query);
        return results.length > 0
          ? results.join('\n---\n')
          : 'No se encontro informacion relevante en la base de conocimiento.';
      }
      return this.integrationsService.executeTool(tenantId, toolName, toolInput);
    };

    const replyText = await this.claudeService.generateReply(
      parsed.text,
      tenantName,
      tools,
      executeTool,
    );
    await this.sendTextMessage(parsed.phoneNumberId, parsed.fromWaId, accessToken, replyText);
    await this.logOutboundMessage(tenantId, parsed.fromWaId, replyText);
  }

  private async saveIncomingMessage(
    parsed: ParsedMessage,
  ): Promise<SavedMessageResult | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tenantRows = await queryRunner.query(
        `SELECT * FROM find_tenant_by_phone_number_id($1)`,
        [parsed.phoneNumberId],
      );

      if (tenantRows.length === 0) {
        this.logger.warn(
          `No hay ningun tenant conectado al phone_number_id ${parsed.phoneNumberId}.`,
        );
        await queryRunner.rollbackTransaction();
        return null;
      }

      const tenantId: string = tenantRows[0].tenant_id;

      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [tenantId],
      );

      const tenantRow = await queryRunner.query(`SELECT name FROM tenants WHERE id = $1`, [
        tenantId,
      ]);
      const tenantName: string = tenantRow[0]?.name ?? 'este negocio';

      const contactRows = await queryRunner.query(
        `INSERT INTO contacts (tenant_id, wa_id, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, wa_id)
         DO UPDATE SET display_name = COALESCE(contacts.display_name, EXCLUDED.display_name)
         RETURNING id`,
        [tenantId, parsed.fromWaId, parsed.contactName],
      );
      const contactId = contactRows[0].id;

      const openConversations = await queryRunner.query(
        `SELECT id FROM conversations
         WHERE contact_id = $1 AND status != 'closed'
         ORDER BY created_at DESC LIMIT 1`,
        [contactId],
      );

      let conversationId: string;
      if (openConversations.length > 0) {
        conversationId = openConversations[0].id;
        await queryRunner.query(
          `UPDATE conversations
           SET last_inbound_at = now(), window_expires_at = now() + interval '24 hours'
           WHERE id = $1`,
          [conversationId],
        );
      } else {
        const newConversation = await queryRunner.query(
          `INSERT INTO conversations (tenant_id, contact_id, status, last_inbound_at, window_expires_at)
           VALUES ($1, $2, 'open', now(), now() + interval '24 hours')
           RETURNING id`,
          [tenantId, contactId],
        );
        conversationId = newConversation[0].id;
      }

      await queryRunner.query(
        `INSERT INTO messages
           (tenant_id, conversation_id, direction, sender_type, content, message_type, whatsapp_message_id, delivery_status)
         VALUES ($1, $2, 'inbound', 'end_user', $3, 'text', $4, 'delivered')
         ON CONFLICT (whatsapp_message_id) DO NOTHING`,
        [tenantId, conversationId, parsed.text, parsed.wamid],
      );

      const credRows = await queryRunner.query(
        `SELECT access_token_encrypted FROM whatsapp_credentials WHERE phone_number_id = $1`,
        [parsed.phoneNumberId],
      );

      await queryRunner.commitTransaction();

      let accessToken: string | null = null;
      if (credRows.length > 0) {
        try {
          accessToken = this.cryptoService.decrypt(credRows[0].access_token_encrypted);
        } catch {
          this.logger.warn('No se pudo descifrar el token guardado.');
        }
      }

      this.logger.log(
        `Mensaje guardado -- tenant: ${tenantId}, de: ${parsed.fromWaId}, texto: "${parsed.text}"`,
      );
      return { tenantId, tenantName, accessToken };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async sendTextMessage(
    phoneNumberId: string,
    toWaId: string,
    accessToken: string,
    text: string,
  ): Promise<void> {
    const url = `https://graph.facebook.com/${this.GRAPH_API_VERSION}/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toWaId,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meta respondio ${response.status}: ${errorBody}`);
    }

    this.logger.log(`Respuesta enviada a ${toWaId}: "${text}"`);
  }

  private async logOutboundMessage(
    tenantId: string,
    toWaId: string,
    text: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [tenantId],
      );

      const contactRows = await queryRunner.query(
        `SELECT id FROM contacts WHERE tenant_id = $1 AND wa_id = $2`,
        [tenantId, toWaId],
      );
      if (contactRows.length === 0) {
        await queryRunner.rollbackTransaction();
        return;
      }
      const contactId = contactRows[0].id;

      const convRows = await queryRunner.query(
        `SELECT id FROM conversations WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [contactId],
      );
      if (convRows.length === 0) {
        await queryRunner.rollbackTransaction();
        return;
      }
      const conversationId = convRows[0].id;

      await queryRunner.query(
        `INSERT INTO messages
           (tenant_id, conversation_id, direction, sender_type, content, message_type, delivery_status)
         VALUES ($1, $2, 'outbound', 'ai', $3, 'text', 'sent')`,
        [tenantId, conversationId, text],
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private parseIncomingMessage(payload: unknown): ParsedMessage | null {
    try {
      const body = payload as any;
      const value = body?.entry?.[0]?.changes?.[0]?.value;
      const message = value?.messages?.[0];

      if (!message || message.type !== 'text') {
        return null;
      }

      const contact = value?.contacts?.[0];

      return {
        phoneNumberId: value.metadata.phone_number_id,
        fromWaId: message.from,
        contactName: contact?.profile?.name ?? null,
        text: message.text.body,
        wamid: message.id,
      };
    } catch {
      return null;
    }
  }
}
