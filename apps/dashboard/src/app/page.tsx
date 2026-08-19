'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchConversations, getToken, clearToken, Conversation } from '@/lib/api';
import { DashboardNav } from '@/components/DashboardNav';

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
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <DashboardNav active="conversations" onLogout={handleLogout} />

        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold text-ink">Conversaciones</h1>
          <p className="text-sm text-muted mt-1">Mensajes recibidos por WhatsApp.</p>
        </div>

        {loading && (
          <div className="flex items-center gap-2.5 text-muted text-sm py-10">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-line border-t-accent animate-spin" />
            Cargando conversaciones…
          </div>
        )}

        {error && (
          <p className="text-sm text-accent bg-accent/10 border border-accent/20 rounded px-4 py-3">
            {error}
          </p>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="border border-dashed border-line rounded-lg py-16 px-6 text-center">
            <p className="font-serif text-lg font-semibold text-ink mb-1.5">
              Todavía no hay conversaciones
            </p>
            <p className="text-sm text-muted max-w-sm mx-auto">
              Cuando un cliente escriba a tu WhatsApp, aparecerá aquí en tiempo real.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {conversations.map((conv) => (
            <li
              key={conv.id}
              className="bg-card border border-line rounded-lg p-4 hover:border-accent/40 transition-colors"
            >
              <p className="font-serif font-semibold text-ink">
                {conv.contactName || conv.contactPhone}
              </p>
              <p className="text-sm text-muted mt-1">{conv.lastMessage || 'Sin mensajes'}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
