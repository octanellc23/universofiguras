import { redirect } from 'next/navigation';
import { readAdminSession } from '@/lib/server/auth';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Entrar', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await readAdminSession()) redirect('/admin');

  return (
    <div className="shell">
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '72px 0' }}>
        <h1 style={{ fontSize: 26, marginBottom: 8 }}>Panel de la tienda</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14.5, marginBottom: 24 }}>
          Desde aquí se cargan las figuras y se despachan los pedidos.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
