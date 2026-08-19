import Link from 'next/link';

export function DashboardNav({
  active,
  onLogout,
}: {
  active: 'conversations' | 'documents';
  onLogout: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-5 mb-8">
      <Link href="/" className="font-serif font-black text-xl tracking-tight text-ink">
        Convers<span className="text-accent">a</span>
      </Link>
      <div className="flex items-center gap-6 text-sm font-medium">
        <Link
          href="/"
          className={
            active === 'conversations'
              ? 'text-ink'
              : 'text-muted hover:text-ink transition-colors'
          }
        >
          Conversaciones
        </Link>
        <Link
          href="/documents"
          className={
            active === 'documents' ? 'text-ink' : 'text-muted hover:text-ink transition-colors'
          }
        >
          Documentos
        </Link>
        <button
          onClick={onLogout}
          className="text-muted hover:text-accent transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
