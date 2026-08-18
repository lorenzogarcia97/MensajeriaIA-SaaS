import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CryptoService } from '../common/crypto/crypto.service';
import { ToolDefinition } from '../ai/claude.service';

interface ToolRow {
  tool_name: string;
  endpoint_path: string | null;
  http_method: string | null;
  integration_id: string | null;
  base_url: string | null;
  auth_type: string | null;
  credentials_encrypted: string | null;
  integration_status: string | null;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Igual que KnowledgeService.searchKnowledgeBase: se llama desde el
   * worker de WhatsApp, fuera de un request HTTP (sin JWT ni
   * TenantInterceptor de por medio), por eso abre su propia
   * transaccion y fija el tenant a mano en vez de usar
   * TenantContextService.
   */
  async listActiveTools(tenantId: string): Promise<ToolDefinition[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [tenantId],
      );

      const rows = await queryRunner.query(
        `SELECT tool_name, description, json_schema
         FROM ai_tools
         WHERE tenant_id = $1 AND is_active = true`,
        [tenantId],
      );

      await queryRunner.commitTransaction();

      return rows.map((r: { tool_name: string; description: string; json_schema: Record<string, unknown> }) => ({
        name: r.tool_name,
        description: r.description,
        input_schema: r.json_schema,
      }));
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Ejecuta una tool dinamica que Claude decidio usar: busca su
   * integracion asociada, descifra las credenciales guardadas (mismo
   * cifrado que whatsapp_credentials), arma la llamada HTTP
   * sustituyendo los parametros que dio Claude en el path de la URL
   * (los que sobran se agregan como query string) y devuelve el
   * cuerpo de la respuesta como texto plano para que Claude lo lea.
   */
  async executeTool(
    tenantId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
  ): Promise<string> {
    const tool = await this.loadTool(tenantId, toolName);

    if (!tool) {
      return `La herramienta "${toolName}" no existe o no esta activa para este negocio.`;
    }
    if (!tool.integration_id || !tool.base_url) {
      return `La herramienta "${toolName}" no tiene una integracion configurada.`;
    }
    if (tool.integration_status !== 'active') {
      return `La integracion de "${toolName}" esta desactivada.`;
    }

    let credentials: Record<string, string> = {};
    try {
      credentials = JSON.parse(this.cryptoService.decrypt(tool.credentials_encrypted || ''));
    } catch {
      this.logger.warn(`No se pudieron descifrar las credenciales de la integracion de "${toolName}".`);
    }

    const url = this.buildUrl(tool.base_url, tool.endpoint_path || '', toolInput);
    const headers = this.buildAuthHeaders(tool.auth_type || 'api_key', credentials);
    const method = (tool.http_method || 'GET').toUpperCase();

    this.logger.log(`Ejecutando tool "${toolName}": ${method} ${url}`);

    const response = await fetch(url, { method, headers });
    const bodyText = await response.text();

    if (!response.ok) {
      return `La consulta a "${toolName}" fallo (HTTP ${response.status}): ${bodyText}`;
    }
    return bodyText;
  }

  private async loadTool(tenantId: string, toolName: string): Promise<ToolRow | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [tenantId],
      );

      const rows = await queryRunner.query(
        `SELECT it.tool_name, it.endpoint_path, it.http_method, it.integration_id,
                ti.base_url, ti.auth_type, ti.credentials_encrypted, ti.status AS integration_status
         FROM ai_tools it
         LEFT JOIN tenant_integrations ti ON ti.id = it.integration_id
         WHERE it.tenant_id = $1 AND it.tool_name = $2 AND it.is_active = true`,
        [tenantId, toolName],
      );

      await queryRunner.commitTransaction();
      return rows[0] ?? null;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private buildUrl(baseUrl: string, endpointPath: string, params: Record<string, unknown>): string {
    const usedKeys = new Set<string>();
    const path = endpointPath.replace(/\{(\w+)\}/g, (_match, key) => {
      usedKeys.add(key);
      const value = params[key];
      return encodeURIComponent(value !== undefined && value !== null ? String(value) : '');
    });

    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (!usedKeys.has(key)) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private buildAuthHeaders(authType: string, credentials: Record<string, string>): Record<string, string> {
    switch (authType) {
      case 'api_key':
        return { [credentials.headerName || 'X-API-Key']: credentials.apiKey };
      case 'bearer_token':
        return { Authorization: `Bearer ${credentials.token}` };
      case 'basic':
        return {
          Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`,
        };
      case 'oauth2':
        // MVP: asume un access token ya vigente guardado en las
        // credenciales -- el refresh de OAuth2 real queda fuera de
        // alcance de esta fase.
        return { Authorization: `Bearer ${credentials.accessToken}` };
      default:
        return {};
    }
  }
}
