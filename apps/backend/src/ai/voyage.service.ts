import { Injectable, Logger } from '@nestjs/common';

interface VoyageEmbeddingItem {
  embedding: number[];
  index: number;
}

interface VoyageResponse {
  data: VoyageEmbeddingItem[];
}

@Injectable()
export class VoyageService {
  private readonly logger = new Logger(VoyageService.name);
  // API directa de Voyage (cuenta independiente en dash.voyageai.com,
  // NO la de MongoDB Atlas -- ver la nota en ESTADO_DEL_PROYECTO.md).
  private readonly API_URL = 'https://api.voyageai.com/v1/embeddings';
  // voyage-4 usa 1024 dimensiones por defecto -- coincide exacto con
  // la columna VECTOR(1024) definida en knowledge_chunks desde el
  // primer dia (migracion 003).
  private readonly MODEL = 'voyage-4';

  async embed(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error('Falta VOYAGE_API_KEY en el .env');
    }

    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.MODEL,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Voyage respondio ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as VoyageResponse;

    return data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}
