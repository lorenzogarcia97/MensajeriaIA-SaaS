import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ToolExecutor = (
  toolName: string,
  toolInput: Record<string, unknown>,
) => Promise<string>;

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'Falta ANTHROPIC_API_KEY en el .env -- las respuestas de IA van a fallar.',
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Genera una respuesta, dandole a Claude una lista de herramientas
   * disponibles -- puede ser la busqueda de la base de conocimiento,
   * una tool dinamica de una integracion del tenant (Fase 3), o
   * cualquier combinacion de ambas. Este servicio no sabe que hace
   * cada una: `executeTool` es el dispatcher generico que decide como
   * ejecutar la que Claude pida, a partir de su nombre. Eso evita que
   * el modulo `ai` dependa de `knowledge` ni de `integrations` --
   * mismo motivo que ya llevo a pasar `searchKnowledgeBase` como
   * funcion en vez de como servicio inyectado.
   */
  async generateReply(
    userMessage: string,
    businessName: string,
    tools: ToolDefinition[],
    executeTool: ToolExecutor,
  ): Promise<string> {
    const systemPrompt =
      `Eres el asistente de atencion al cliente de "${businessName}", un negocio ` +
      `que atiende a sus clientes por WhatsApp. Responde siempre en espanol, de ` +
      `forma breve, amable y profesional (2-3 oraciones como maximo -- esto es un ` +
      `chat de WhatsApp, no un correo). Tienes herramientas disponibles para buscar ` +
      `informacion del negocio (horarios, politicas, catalogo, preguntas frecuentes) ` +
      `o consultar sistemas propios del negocio (inventario, pedidos, etc) -- usalas ` +
      `cuando la pregunta lo amerite, en vez de inventar una respuesta. Si una ` +
      `herramienta no encuentra nada relevante, dilo con honestidad. Si preguntan ` +
      `algo sin relacion al negocio, redirige amablemente la conversacion.`;

    const messages: any[] = [{ role: 'user', content: userMessage }];

    // Maximo 3 vueltas de tool-calling, para evitar un loop infinito
    // si el modelo insistiera en llamar herramientas sin parar.
    for (let turn = 0; turn < 3; turn++) {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 500,
        system: systemPrompt,
        ...(tools.length > 0 ? { tools } : {}),
        messages,
      } as any);

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find((b: any) => b.type === 'text');
        return textBlock ? (textBlock as any).text : 'Disculpa, no pude generar una respuesta.';
      }

      // Guarda la respuesta del modelo (incluye el tool_use) en el historial
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: any[] = [];
      for (const block of response.content as any[]) {
        if (block.type === 'tool_use') {
          this.logger.log(
            `Claude pidio usar la herramienta "${block.name}" con input: ${JSON.stringify(block.input)}`,
          );

          let resultContent: string;
          let isError = false;
          try {
            resultContent = await executeTool(block.name, block.input);
          } catch (err) {
            isError = true;
            resultContent = `Error ejecutando la herramienta "${block.name}": ${(err as Error).message}`;
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultContent,
            ...(isError ? { is_error: true } : {}),
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return 'Disculpa, tuve un problema generando la respuesta.';
  }
}
