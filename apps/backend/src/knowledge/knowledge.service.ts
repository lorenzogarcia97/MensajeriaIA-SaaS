import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { VoyageService } from '../ai/voyage.service';
import { chunkText } from './chunking';

/**
 * Solo los metodos que se llaman DESDE un request HTTP real, con el
 * TenantInterceptor ya manejando la transaccion -- por eso puede
 * inyectar TenantContextService (REQUEST-scoped) sin problema:
 * KnowledgeController tambien es REQUEST-scoped por transitividad, y
 * eso es exactamente lo esperado para un controller.
 *
 * La busqueda semantica que usa el worker de WhatsApp (fuera de
 * cualquier request) vive aparte, en KnowledgeSearchService, un
 * singleton de verdad -- ver el comentario ahi para el porque.
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly voyageService: VoyageService,
  ) {}

  // Usado por POST /knowledge/documents -- dentro de un request HTTP
  // real, con el TenantInterceptor ya manejando la transaccion.
  async ingestDocument(displayName: string, content: string) {
    const tenantId = this.tenantContext.getTenantId();
    const manager = this.tenantContext.manager;

    const chunks = chunkText(content);
    if (chunks.length === 0) {
      throw new BadRequestException('El documento esta vacio.');
    }

    const sourceRows = await manager.query(
      `INSERT INTO knowledge_sources (tenant_id, source_type, display_name, status)
       VALUES ($1, 'manual_text', $2, 'processing')
       RETURNING id`,
      [tenantId, displayName],
    );
    const sourceId = sourceRows[0].id;

    try {
      const embeddings = await this.voyageService.embed(chunks);

      for (let i = 0; i < chunks.length; i++) {
        const vectorLiteral = `[${embeddings[i].join(',')}]`;
        await manager.query(
          `INSERT INTO knowledge_chunks
             (tenant_id, knowledge_source_id, chunk_index, content, token_count, embedding)
           VALUES ($1, $2, $3, $4, $5, $6::vector)`,
          [tenantId, sourceId, i, chunks[i], Math.ceil(chunks[i].length / 4), vectorLiteral],
        );
      }

      await manager.query(
        `UPDATE knowledge_sources
         SET status = 'indexed', chunk_count = $1, last_indexed_at = now()
         WHERE id = $2`,
        [chunks.length, sourceId],
      );

      this.logger.log(
        `Documento "${displayName}" indexado: ${chunks.length} fragmentos (tenant ${tenantId})`,
      );

      return { sourceId, chunkCount: chunks.length };
    } catch (err) {
      await manager.query(`UPDATE knowledge_sources SET status = 'failed' WHERE id = $1`, [
        sourceId,
      ]);
      throw err;
    }
  }

  async listDocuments() {
    const manager = this.tenantContext.manager;
    return manager.query(
      `SELECT id, display_name, status, chunk_count, created_at, last_indexed_at
       FROM knowledge_sources
       ORDER BY created_at DESC`,
    );
  }

  async deleteDocument(id: string): Promise<boolean> {
    const manager = this.tenantContext.manager;
    // ON DELETE CASCADE en knowledge_chunks (migracion 003) se encarga
    // de borrar los fragmentos asociados solo -- no hace falta un
    // segundo DELETE. RLS ya se encarga de que solo puedas borrar
    // documentos de tu propio tenant, aunque adivines otro id.
    const result = await manager.query(
      `DELETE FROM knowledge_sources WHERE id = $1 RETURNING id`,
      [id],
    );
    return result.length > 0;
  }
}
