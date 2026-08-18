/**
 * Parte un texto largo en fragmentos manejables, respetando saltos de
 * parrafo cuando es posible en vez de cortar a la mitad de una frase.
 * Aproximacion simple por caracteres (no por tokens exactos) --
 * suficiente para el MVP, sin agregar una libreria de tokenizacion
 * como dependencia nueva.
 */
export function chunkText(text: string, targetSize = 1500, overlap = 200): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length > targetSize && current.length > 0) {
      chunks.push(current.trim());
      // Overlap: el siguiente fragmento arranca con el final del
      // anterior, para no perder contexto justo en el corte.
      const overlapText = current.slice(-overlap);
      current = overlapText + '\n\n' + paragraph;
    } else {
      current = current ? current + '\n\n' + paragraph : paragraph;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  // Si un parrafo individual es mas grande que el objetivo, se corta
  // a la fuerza (evita fragmentos gigantes que rompan el limite de
  // la API de embeddings).
  return chunks.flatMap((chunk) => {
    if (chunk.length <= targetSize * 1.5) return [chunk];
    const pieces: string[] = [];
    for (let i = 0; i < chunk.length; i += targetSize) {
      pieces.push(chunk.slice(i, i + targetSize + overlap));
    }
    return pieces;
  });
}
