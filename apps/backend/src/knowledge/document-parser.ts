import { BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as JSZip from 'jszip';
import { ImageMediaType } from '../ai/vision.service';

export type SupportedFileSourceType = 'pdf' | 'docx' | 'xlsx';

// Debajo de este tamano de texto se asume que la pagina/hoja depende
// de contenido visual (organigrama, diagrama, grafico) para transmitir
// su informacion -- el texto solo no alcanza. No es un umbral exacto,
// es una heuristica barata: mejor mandar de mas una pagina de titulo
// casi vacia a Claude Vision que quedarse callado sobre un organigrama.
const SPARSE_TEXT_THRESHOLD = 200;

export type ImageDescriber = (
  buffer: Buffer,
  mediaType: ImageMediaType,
  label: string,
) => Promise<string>;

const EXTENSION_TO_TYPE: Record<string, SupportedFileSourceType> = {
  pdf: 'pdf',
  docx: 'docx',
  xlsx: 'xlsx',
  xls: 'xlsx',
};

const MIMETYPE_TO_TYPE: Record<string, SupportedFileSourceType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
};

const IMAGE_EXTENSION_TO_MEDIA_TYPE: Record<string, ImageMediaType> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/**
 * Detecta el tipo de documento por mimetype primero (mas confiable) y
 * cae a la extension del nombre de archivo si el mimetype no es uno
 * de los conocidos (algunos navegadores/clientes mandan
 * "application/octet-stream" para Office/PDF).
 */
export function detectFileSourceType(originalName: string, mimetype: string): SupportedFileSourceType {
  if (MIMETYPE_TO_TYPE[mimetype]) {
    return MIMETYPE_TO_TYPE[mimetype];
  }

  const extension = originalName.split('.').pop()?.toLowerCase() ?? '';
  const byExtension = EXTENSION_TO_TYPE[extension];
  if (byExtension) {
    return byExtension;
  }

  throw new BadRequestException(
    `Formato no soportado (${originalName}). Formatos aceptados: PDF, DOCX, XLSX/XLS.`,
  );
}

/**
 * Extrae el texto plano de un PDF con pdf-parse y, ademas, renderiza a
 * imagen (via el getScreenshot() de pdf-parse, que ya trae @napi-rs/canvas
 * -- no hizo falta sumar una libreria nueva de PDF-a-imagen) cualquier
 * pagina cuyo texto extraido sea escaso o que tenga imagenes incrustadas
 * -- senal de que un organigrama, diagrama o grafico carga el peso real
 * del contenido de esa pagina. Esas paginas se mandan a Claude Vision
 * (VisionService, Haiku) y la descripcion se agrega al texto de esa
 * pagina antes de unir todo.
 */
async function extractPdfText(buffer: Buffer, describeImage: ImageDescriber): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();

    let imagePagesWithContent = new Set<number>();
    try {
      // imageBuffer/imageDataUrl en false: solo interesa saber SI hay
      // imagenes reales por pagina (mas alla de iconos chicos, que ya
      // filtra el imageThreshold por defecto), no decodificarlas aca --
      // las paginas que terminen marcadas como "visuales" se vuelven a
      // renderizar completas mas abajo con getScreenshot().
      const imageResult = await parser.getImage({ imageBuffer: false, imageDataUrl: false });
      imagePagesWithContent = new Set(
        imageResult.pages.filter((p) => p.images.length > 0).map((p) => p.pageNumber),
      );
    } catch {
      // Si la deteccion de imagenes falla (PDF raro), seguimos solo con
      // la heuristica de texto escaso -- no es motivo para abortar.
    }

    const visualPages = textResult.pages
      .filter((p) => p.text.trim().length < SPARSE_TEXT_THRESHOLD || imagePagesWithContent.has(p.num))
      .map((p) => p.num);

    let combined = textResult.pages.map((p) => p.text).join('\n\n');

    if (visualPages.length > 0) {
      const screenshots = await parser.getScreenshot({ partial: visualPages, scale: 2 });
      for (const shot of screenshots.pages) {
        const label = `la pagina ${shot.pageNumber} de un documento PDF`;
        const description = await describeImage(Buffer.from(shot.data), 'image/png', label);
        if (description) {
          combined += `\n\n[Descripcion visual de la pagina ${shot.pageNumber}]\n${description}`;
        }
      }
    }

    return combined;
  } catch (err) {
    const name = err instanceof Error ? err.constructor.name : '';
    if (name === 'PasswordException') {
      throw new BadRequestException(
        'El PDF esta protegido con contraseña -- no se puede extraer el texto.',
      );
    }
    if (name === 'InvalidPDFException') {
      throw new BadRequestException('El PDF esta corrupto o no es un PDF valido.');
    }
    throw err instanceof BadRequestException ? err : new BadRequestException('No se pudo leer el PDF.');
  } finally {
    await parser.destroy();
  }
}

/**
 * Busca imagenes raster embebidas dentro de un OOXML (DOCX o XLSX, que
 * son en el fondo un .zip) bajo la carpeta indicada (word/media o
 * xl/media), y le pide a Claude una descripcion de cada una.
 */
async function describeEmbeddedImages(
  zip: JSZip,
  mediaFolder: 'word/media' | 'xl/media',
  contextLabel: string,
  describeImage: ImageDescriber,
): Promise<string> {
  const mediaFiles = Object.keys(zip.files).filter((name) => {
    if (!name.startsWith(`${mediaFolder}/`)) return false;
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return ext in IMAGE_EXTENSION_TO_MEDIA_TYPE;
  });

  let appended = '';
  for (let i = 0; i < mediaFiles.length; i++) {
    const name = mediaFiles[i];
    const ext = name.split('.').pop()!.toLowerCase();
    const mediaType = IMAGE_EXTENSION_TO_MEDIA_TYPE[ext];
    const data = await zip.files[name].async('nodebuffer');
    const label = `${contextLabel} (imagen ${i + 1} de ${mediaFiles.length})`;
    const description = await describeImage(data, mediaType, label);
    if (description) {
      appended += `\n\n[Descripcion visual de imagen incrustada ${i + 1}]\n${description}`;
    }
  }
  return appended;
}

async function extractDocxText(buffer: Buffer, describeImage: ImageDescriber): Promise<string> {
  let text: string;
  try {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } catch {
    throw new BadRequestException('El DOCX esta corrupto o no se pudo leer.');
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    // mammoth extrae texto pero no describe imagenes/SmartArt embebidos
    // (viven como archivos sueltos en word/media/ dentro del .docx) --
    // se procesan aparte con vision.
    text += await describeEmbeddedImages(
      zip,
      'word/media',
      'una imagen incrustada en un documento DOCX',
      describeImage,
    );
  } catch {
    // Un DOCX sin carpeta word/media (o un zip raro) no es un error --
    // simplemente no habia imagenes que describir.
  }

  return text;
}

/**
 * Extrae un resumen liviano (titulo, etiquetas, valores) de un grafico
 * nativo de Excel a partir de su XML crudo (xl/charts/chartN.xml), sin
 * sumar una libreria de parseo XML completa solo para esto. No es una
 * lectura perfecta del grafico, pero los valores cacheados que Excel
 * guarda en el propio XML (c:v) son en la practica mas precisos para
 * responder preguntas que pedirle a un modelo de vision que lea numeros
 * de una imagen renderizada -- que ademas no podemos generar sin sumar
 * un motor de render de Office (LibreOffice headless u similar), fuera
 * de alcance para este pipeline.
 */
function summarizeChartXml(xml: string): string {
  try {
    const titleMatch = xml.match(/<c:title>[\s\S]*?<a:t>([^<]+)<\/a:t>/);
    const labels = [...new Set([...xml.matchAll(/<a:t>([^<]+)<\/a:t>/g)].map((m) => m[1]).filter(Boolean))];
    const values = [...xml.matchAll(/<c:v>([^<]+)<\/c:v>/g)].map((m) => m[1]).filter(Boolean).slice(0, 50);

    const parts: string[] = [];
    if (titleMatch) parts.push(`Titulo: ${titleMatch[1]}`);
    if (labels.length) parts.push(`Etiquetas/series: ${labels.join(', ')}`);
    if (values.length) parts.push(`Valores: ${values.join(', ')}`);
    return parts.join('. ');
  } catch {
    return '';
  }
}

async function extractXlsxText(buffer: Buffer, describeImage: ImageDescriber): Promise<string> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new BadRequestException('El XLSX esta corrupto o no se pudo leer.');
  }

  const sheetsText = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return `# ${sheetName}\n${csv}`;
  });
  let text = sheetsText.join('\n\n');

  // SheetJS ya captura filas/columnas como texto -- de ahi no hace
  // falta vision. Solo se aplica tratamiento visual/textual extra a lo
  // que SheetJS deja afuera de su modelo de celdas: imagenes pegadas
  // (xl/media/) y graficos nativos de verdad (xl/charts/).
  try {
    const zip = await JSZip.loadAsync(buffer);

    text += await describeEmbeddedImages(
      zip,
      'xl/media',
      'una imagen incrustada en una planilla de Excel',
      describeImage,
    );

    const chartFiles = Object.keys(zip.files).filter((name) => /^xl\/charts\/chart\d+\.xml$/i.test(name));
    for (let i = 0; i < chartFiles.length; i++) {
      const xml = await zip.files[chartFiles[i]].async('text');
      const summary = summarizeChartXml(xml);
      if (summary) {
        text += `\n\n[Grafico nativo de Excel detectado ${i + 1} de ${chartFiles.length}]\n${summary}`;
      }
    }
  } catch {
    // Un XLSX sin xl/media ni xl/charts (la inmensa mayoria) no es un
    // error -- simplemente no habia nada visual que agregar.
  }

  return text;
}

/**
 * Extrae texto plano (+ descripciones visuales cuando aplica) de un
 * archivo subido segun su tipo detectado -- el resultado se reutiliza
 * tal cual con KnowledgeService.ingestDocument (mismo pipeline de
 * chunking + embeddings que la carga de texto pegado a mano).
 */
export async function extractTextFromFile(
  sourceType: SupportedFileSourceType,
  buffer: Buffer,
  describeImage: ImageDescriber,
): Promise<string> {
  let text: string;
  switch (sourceType) {
    case 'pdf':
      text = await extractPdfText(buffer, describeImage);
      break;
    case 'docx':
      text = await extractDocxText(buffer, describeImage);
      break;
    case 'xlsx':
      text = await extractXlsxText(buffer, describeImage);
      break;
  }

  if (!text || !text.trim()) {
    throw new BadRequestException(
      'No se pudo extraer texto del archivo (puede estar vacio, ser una imagen escaneada sin texto, o tener un formato no reconocido).',
    );
  }

  return text;
}
