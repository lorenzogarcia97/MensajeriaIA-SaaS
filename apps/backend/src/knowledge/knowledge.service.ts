import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { VoyageService } from '../ai/voyage.service';
import { ToolDefinition } from '../ai/claude.service';
import { chunkText } from './chunking';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
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

  /**
   * Definicion de la tool de busqueda para Claude (ver
   * ClaudeService.generateReply) -- vive aca, no en el modulo `ai`,
   * porque describe una capacidad de `knowledge`; el modulo `ai` no
   * sabe nada de documentos ni de RAG.
   */
  getToolDefinition(): ToolDefinition {
    return {
      name: 'search_knowledge_base',
      description:
        'Busca informacion en la base de conocimiento del negocio (politicas, ' +
        'horarios, catalogo, preguntas frecuentes). Usar cuando el cliente ' +
        'pregunta algo especifico del negocio que no se sabe de memoria.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'La consulta de busqueda, enfocada en el tema preguntado.',
          },
        },
        required: ['query'],
      },
    };
  }

  /**
   * Busqueda semantica para el flujo de WhatsApp -- se llama DESDE
   * fuera de un request HTTP (no hay TenantInterceptor ni JWT de por
   * medio), por eso abre su propia transaccion y fija el tenant a
   * mano, en vez de usar TenantContextService.
   */
  async searchKnowledgeBase(tenantId: string, query: string, topK = 5): Promise<string[]> {
    const [queryEmbedding] = await this.voyageService.embed([query]);
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [tenantId],
      );

      // <=> es la distancia coseno -- coincide con el indice HNSW
      // (vector_cosine_ops) creado en la migracion 003, asi la
      // busqueda realmente usa ese indice en vez de escanear todo.
      const rows = await queryRunner.query(
        `SELECT content FROM knowledge_chunks
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vectorLiteral, topK],
      );

      await queryRunner.commitTransaction();
      return rows.map((r: { content: string }) => r.content);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
