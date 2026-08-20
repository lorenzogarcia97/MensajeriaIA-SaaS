import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

/**
 * Describe una imagen (pagina de PDF renderizada, o imagen/grafico
 * incrustado en DOCX/XLSX) en texto plano, para que el pipeline de
 * chunking/embeddings de KnowledgeService pueda indexarla como
 * cualquier otro parrafo. Usa Haiku (no Sonnet/Opus, ver
 * ClaudeService) a proposito: es una tarea de descripcion, no de
 * razonamiento -- Haiku 4.5 es sensiblemente mas barato y mas que
 * suficiente para "que dice este organigrama/tabla/grafico".
 *
 * Nunca tira: si Claude falla (rate limit, imagen rechazada, etc.),
 * devuelve string vacio y quien llama sigue con el texto plano que sí
 * se pudo extraer -- una descripcion visual que falla no debe tirar
 * abajo la subida de todo el documento.
 */
@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly client: Anthropic;
  private readonly MODEL = 'claude-haiku-4-5';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'Falta ANTHROPIC_API_KEY en el .env -- las descripciones visuales van a fallar.',
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  async describeImage(buffer: Buffer, mediaType: ImageMediaType, label: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.MODEL,
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
              },
              {
                type: 'text',
                text:
                  `Describe el contenido de ${label}, incluyendo cualquier organigrama, ` +
                  `diagrama de flujo, tabla o grafico, en texto claro y estructurado ` +
                  `(ej: "X depende de Y", "el proceso va de A a B a C"). Si es solo texto ` +
                  `o parrafos normales sin elementos visuales relevantes, resumilo en una ` +
                  `linea. Responde en espanol, directo, sin preambulos.`,
              },
            ],
          },
        ],
      } as any);

      const textBlock = (response.content as any[]).find((b) => b.type === 'text');
      return textBlock ? (textBlock.text as string).trim() : '';
    } catch (err) {
      this.logger.warn(`No se pudo generar descripcion visual de ${label}: ${(err as Error).message}`);
      return '';
    }
  }
}
