const API_URL = 'http://localhost:3001';

export function saveToken(token: string) {
  localStorage.setItem('token', token);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function clearToken() {
  localStorage.removeItem('token');
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error('Credenciales invalidas');
  }
  const data = await res.json();
  return data.access_token;
}

export interface Conversation {
  id: string;
  status: string;
  createdAt: string;
  contactName: string | null;
  contactPhone: string;
  lastMessage: string | null;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const token = getToken();
  if (!token) throw new Error('No hay sesion activa');
  const res = await fetch(`${API_URL}/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('No se pudieron cargar las conversaciones');
  }
  return res.json();
}

export interface KnowledgeDocument {
  id: string;
  display_name: string;
  status: string;
  chunk_count: number;
  created_at: string;
  last_indexed_at: string | null;
}

export async function fetchDocuments(): Promise<KnowledgeDocument[]> {
  const token = getToken();
  if (!token) throw new Error('No hay sesion activa');
  const res = await fetch(`${API_URL}/knowledge/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('No se pudieron cargar los documentos');
  return res.json();
}

export async function uploadDocument(
  displayName: string,
  content: string,
): Promise<{ sourceId: string; chunkCount: number }> {
  const token = getToken();
  if (!token) throw new Error('No hay sesion activa');
  const res = await fetch(`${API_URL}/knowledge/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName, content }),
  });
  if (!res.ok) throw new Error('No se pudo subir el documento');
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('No hay sesion activa');
  const res = await fetch(`${API_URL}/knowledge/documents/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('No se pudo borrar el documento');
}
