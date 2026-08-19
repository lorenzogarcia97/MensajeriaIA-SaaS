'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  getToken,
  clearToken,
  KnowledgeDocument,
} from '@/lib/api';
import { DashboardNav } from '@/components/DashboardNav';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [content, setContent] = useState('');
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

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    setUploadError('');
    setUploading(true);
    try {
      await uploadDocument(displayName, content);
      setDisplayName('');
      setContent('');
      await loadDocuments();
    } catch {
      setUploadError('No se pudo subir el documento. Revisa que tenga texto.');
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

          {uploadError && (
            <p className="text-sm text-accent bg-accent/10 border border-accent/20 rounded px-3 py-2 mb-4">
              {uploadError}
            </p>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            Nombre
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            placeholder="Ej: Política de devoluciones"
            className="w-full border border-line rounded px-3 py-2.5 mb-4 bg-white text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />

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

          <button
            type="submit"
            disabled={uploading}
            className="bg-accent text-white rounded px-5 py-2.5 font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {uploading ? 'Subiendo…' : 'Subir documento'}
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
