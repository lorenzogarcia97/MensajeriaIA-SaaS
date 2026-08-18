import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../common/tenant/tenant-context.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async findOpenConversations() {
    // Consulta cruda (no via el entity Conversation) para poder unir
    // con contacts y traer algo mostrable: nombre/telefono del
    // contacto y una vista previa del ultimo mensaje. Sigue corriendo
    // dentro de la misma transaccion con RLS activo -- el filtro por
    // tenant sigue siendo automatico, no hay WHERE tenant_id a mano.
    return this.tenantContext.manager.query(`
      SELECT
        c.id,
        c.status,
        c.created_at AS "createdAt",
        ct.display_name AS "contactName",
        ct.wa_id AS "contactPhone",
        (
          SELECT m.content FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC LIMIT 1
        ) AS "lastMessage"
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.status != 'closed'
      ORDER BY c.created_at DESC
    `);
  }
}
