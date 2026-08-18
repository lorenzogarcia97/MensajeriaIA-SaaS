'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchConversations, getToken, clearToken, Conversation } from '@/lib/api';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    fetchConversations()
      .then(setConversations)
      .catch(() => setError('No se pudieron cargar las conversaciones.'))
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Conversaciones</h1>
          <div className="flex items-center gap-4">
            <a href="/documents" className="text-sm text-gray-700 underline">
              Documentos
            </a>
            <button onClick={handleLogout} className="text-sm text-red-600 underline">
              Cerrar sesion
            </button>
          </div>
        </div>

        {loading && <p className="text-gray-700">Cargando...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && conversations.length === 0 && (
          <p className="text-gray-500">Todavia no hay conversaciones.</p>
        )}

        <ul className="space-y-3">
          {conversations.map((conv) => (
            <li key={conv.id} className="bg-white rounded-lg shadow-sm p-4">
              <p className="font-medium text-gray-900">
                {conv.contactName || conv.contactPhone}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {conv.lastMessage || 'Sin mensajes'}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
