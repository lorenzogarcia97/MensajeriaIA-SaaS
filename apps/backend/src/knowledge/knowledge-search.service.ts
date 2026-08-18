import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VoyageService } from '../ai/voyage.service';
import { ToolDefinition } from '../ai/claude.service';

/**
 * Parte de KnowledgeService que se llama DESDE FUERA de un request HTTP
 * (el worker de WhatsApp, sin JWT ni TenantInterceptor de por medio).
 * Separada en su propia clase, SINGLETON de verdad, a proposito: no
 * inyecta TenantContextService (REQUEST-scoped) ni nada que dependa de
 * el, ni directa ni transitivamente -- si lo hiciera, esta clase (y
 * todo lo que la inyecte, incluido WhatsappIncomingProcessor) se
 * volveria REQUEST-scoped tambien, silenciosamente. Ese fue exactamente
 * el bug real: KnowledgeService (con TenantContextService en su
 * constructor) se inyectaba en WhatsappService, y por transitividad
 * WhatsappIncomingProcessor terminaba REQUEST-scoped -- BullMQ no puede
 * registrar sus @OnWorkerEvent en un provider scoped ("Warning! ...this
 * handler will be ignored"), asi que WhatsappIncomingProcessor#onFailed
 * quedaba mudo y, peor, el propio Worker corriendo fuera de un request
 * quedaba en un estado de DI que Nest no soporta de verdad.
 */
@Injectable()
export class KnowledgeSearchService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly voyageService: VoyageService,
  ) {}

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
