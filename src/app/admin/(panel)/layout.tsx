import Link from 'next/link';
import { AdminSessionSync, LogoutButton } from '@/components/admin/AdminSession';
import { requireAdmin } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

// El panel no se indexa. robots.txt ya lo excluye, pero un enlace suelto en
// cualquier lado bastaría para que un buscador lo intentara igual.
export const metadata = {
  title: { default: 'Panel', template: '%s · Panel' },
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // Una sola verificación, en el layout: todo lo que cuelga de aquí ya está
  // protegido. /admin/login queda fuera de este grupo a propósito, si no se
  // redirigiría a sí mismo para siempre.
  const session = await requireAdmin();

  return (
    <>
      <AdminSessionSync />

      <header className="admin-bar">
        <div className="shell admin-bar__inner">
          <Link href="/admin" className="logo">
            <span className="logo__mark">◆</span> Panel
          </Link>

          <nav className="admin-nav">
            <Link href="/admin/productos">Figuras</Link>
            <Link href="/admin/blog">Reseñas</Link>
            <Link href="/admin/pedidos">Pedidos</Link>
            <Link href="/admin/ventas">Ventas</Link>
            <Link href="/admin/tienda">La tienda</Link>
            <Link href="/admin/envios">Envíos</Link>
            <Link href="/" target="_blank">
              Ver la tienda ↗
            </Link>
          </nav>

          <span className="admin-bar__user">{session.email}</span>
          <LogoutButton />
        </div>
      </header>

      <main className="shell" style={{ paddingBottom: 80 }}>
        {children}
      </main>
    </>
  );
}
