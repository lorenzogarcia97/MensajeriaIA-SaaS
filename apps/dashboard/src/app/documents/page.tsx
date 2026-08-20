'use client';

import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchDocuments,
  uploadDocument,
  uploadDocumentFile,
  deleteDocument,
  getToken,
  clearToken,
  KnowledgeDocument,
} from '@/lib/api';
import { DashboardNav } from '@/components/DashboardNav';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type UploadMode = 'text' | 'file';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<UploadMode>('text');
  const [displayName, setDisplayName] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const router = useRouter();

  async function loadDocuments() {
    setLoading(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      setError('');
    } catch {
      setError('No se pudieron cargar los documentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setUploadError('');
    if (selected && selected.size > MAX_FILE_SIZE_BYTES) {
      setUploadError('El archivo supera el limite de 10MB.');
      setFile(null);
      e.target.value = '';
      return;
    }
    setFile(selected);
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    setUploadError('');
    setUploading(true);
    try {
      if (mode === 'file') {
        if (!file) {
          setUploadError('Elegi un archivo para subir.');
          return;
        }
        await uploadDocumentFile(file, displayName);
        setFile(null);
      } else {
        await uploadDocument(displayName, content);
        setContent('');
      }
      setDisplayName('');
      await loadDocuments();
    } catch (err) {
      setUploadError(
        err instanceof Error && mode === 'file'
          ? err.message
          : 'No se pudo subir el documento. Revisa que tenga texto.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Borrar este documento? Esta acción no se puede deshacer.')) return;
    try {
      await deleteDocument(id);
      await loadDocuments();
    } catch {
      alert('No se pudo borrar el documento.');
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <DashboardNav active="documents" onLogout={handleLogout} />

        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold text-ink">Documentos</h1>
          <p className="text-sm text-muted mt-1">
            La base de conocimiento de la que aprende tu IA.
          </p>
        </div>

        <form
          onSubmit={handleUpload}
          className="bg-card border border-line rounded-lg p-6 mb-10"
        >
          <h2 className="font-serif font-semibold text-ink mb-4">Subir un documento nuevo</h2>

          <div className="flex gap-1 mb-5 border border-line rounded-lg p-1 w-fit">
            {(
              [
                ['text', 'Pegar texto'],
                ['file', 'Subir archivo'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setUploadError('');
                }}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  mode === value
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {uploadError && (
            <p className="text-sm text-accent bg-accent/10 border border-accent/20 rounded px-3 py-2 mb-4">
              {uploadError}
            </p>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            Nombre {mode === 'file' && <span className="normal-case font-normal">(opcional, se usa el nombre del archivo si lo dejas vacío)</span>}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required={mode === 'text'}
            placeholder="Ej: Política de devoluciones"
            className="w-full border border-line rounded px-3 py-2.5 mb-4 bg-white text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />

          {mode === 'text' ? (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                Contenido
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={6}
                placeholder="Pega aquí el texto (horarios, políticas, catálogo, preguntas frecuentes...)"
                className="w-full border border-line rounded px-3 py-2.5 mb-4 bg-white text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-y"
              />
            </>
          ) : (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                Archivo
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.xlsx,.xls"
                onChange={handleFileChange}
                className="w-full border border-line rounded px-3 py-2.5 mb-1.5 bg-white text-ink file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-accent/10 file:text-accent file:font-semibold file:cursor-pointer cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
              <p className="text-xs text-muted mb-4">
                PDF, Word o Excel, hasta 10MB.
                {file && (
                  <span className="text-ink font-semibold"> Seleccionado: {file.name}</span>
                )}
              </p>
            </>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="bg-accent text-white rounded px-5 py-2.5 font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {uploading
              ? mode === 'file'
                ? 'Procesando archivo… puede tardar unos segundos'
                : 'Subiendo…'
              : 'Subir documento'}
          </button>
        </form>

        <h2 className="font-serif font-semibold text-ink mb-4">Documentos cargados</h2>

        {loading && (
          <div className="flex items-center gap-2.5 text-muted text-sm py-10">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-line border-t-accent animate-spin" />
            Cargando documentos…
          </div>
        )}

        {error && (
          <p className="text-sm text-accent bg-accent/10 border border-accent/20 rounded px-4 py-3">
            {error}
          </p>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="border border-dashed border-line rounded-lg py-16 px-6 text-center">
            <p className="font-serif text-lg font-semibold text-ink mb-1.5">
              Todavía no subiste ningún documento
            </p>
            <p className="text-sm text-muted max-w-sm mx-auto">
              Sube horarios, políticas o catálogo para que tu IA responda con información real.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="bg-card border border-line rounded-lg p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-serif font-semibold text-ink">{doc.display_name}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gold bg-gold/10 border border-gold/25 rounded-full px-2 py-0.5">
                    {doc.status}
                  </span>
                  <span className="text-sm text-muted">
                    {doc.chunk_count} fragmento{doc.chunk_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-sm text-muted hover:text-accent transition-colors"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
