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
      setError('Email o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif font-black text-2xl tracking-tight text-ink">
            Convers<span className="text-accent">a</span>
          </div>
          <p className="text-sm text-muted mt-1.5">Panel de administración</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-line rounded-lg p-8 shadow-[0_24px_48px_-24px_rgba(18,48,46,0.25)]"
        >
          <h1 className="font-serif text-xl font-bold text-ink mb-6">Iniciar sesión</h1>

          {error && (
            <p className="text-sm text-accent bg-accent/10 border border-accent/20 rounded px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-line rounded px-3 py-2.5 mb-4 bg-white text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />

          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-line rounded px-3 py-2.5 mb-6 bg-white text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white rounded py-2.5 font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
