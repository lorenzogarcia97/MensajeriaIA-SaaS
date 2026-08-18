'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  getToken,
  KnowledgeDocument,
} from '@/lib/api';

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
    if (!confirm('¿Borrar este documento? Esta accion no se puede deshacer.')) return;
    try {
      await deleteDocument(id);
      await loadDocuments();
    } catch {
      alert('No se pudo borrar el documento.');
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Documentos</h1>
          <a href="/" className="text-sm text-gray-700 underline">
            Ver conversaciones
          </a>
        </div>

        <form onSubmit={handleUpload} className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h2 className="font-medium text-gray-900 mb-3">Subir un documento nuevo</h2>
          {uploadError && <p className="text-red-600 text-sm mb-3">{uploadError}</p>}
          <label className="block text-sm font-medium mb-1 text-gray-800">Nombre</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            placeholder="Ej: Politica de devoluciones"
            className="w-full border rounded px-3 py-2 mb-3 text-gray-900"
          />
          <label className="block text-sm font-medium mb-1 text-gray-800">Contenido</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={6}
            placeholder="Pega aqui el texto (horarios, politicas, catalogo, preguntas frecuentes...)"
            className="w-full border rounded px-3 py-2 mb-3 text-gray-900"
          />
          <button
            type="submit"
            disabled={uploading}
            className="bg-blue-600 text-white rounded px-4 py-2 font-medium disabled:opacity-50"
          >
            {uploading ? 'Subiendo...' : 'Subir documento'}
          </button>
        </form>

        <h2 className="font-medium text-gray-900 mb-3">Documentos cargados</h2>
        {loading && <p className="text-gray-700">Cargando...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && documents.length === 0 && (
          <p className="text-gray-500">Todavia no subiste ningun documento.</p>
        )}

        <ul className="space-y-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-medium text-gray-900">{doc.display_name}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {doc.status} -- {doc.chunk_count} fragmento{doc.chunk_count !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-sm text-red-600 underline"
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
