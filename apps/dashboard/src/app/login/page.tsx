'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login, saveToken } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await login(email, password);
      saveToken(token);
      router.push('/');
    } catch {
      setError('Email o contrasena incorrectos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6 text-gray-900">Iniciar sesion</h1>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <label className="block text-sm font-medium mb-1 text-gray-800">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded px-3 py-2 mb-4 text-gray-900"
        />
        <label className="block text-sm font-medium mb-1 text-gray-800">Contrasena</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border rounded px-3 py-2 mb-6 text-gray-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded py-2 font-medium disabled:opacity-50"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
