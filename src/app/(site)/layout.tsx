import Link from 'next/link';
import { Header } from '@/components/Header';
import { CartProvider } from '@/lib/client/cart';
import { getStoreContent } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const store = await getStoreContent();

  return (
    <CartProvider>
      <Header />
      <main>{children}</main>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div>
            <div className="logo" style={{ marginBottom: 10 }}>
              <span className="logo__mark">◆</span> {store.storeName}
            </div>
            <p>Envíos a Estados Unidos y Latinoamérica</p>
          </div>

          <nav className="footer-links">
            <Link href="/">Tienda</Link>
            <Link href="/blog">Reseñas</Link>
            {/* El enlace a Nosotros solo aparece cuando hay algo escrito:
                mandar a un visitante a una página vacía es peor que no
                ofrecerla. */}
            {store.about && <Link href="/nosotros">Nosotros</Link>}
          </nav>

          <nav className="footer-links">
            <Link href="/envios">Envíos</Link>
            <Link href="/devoluciones">Devoluciones</Link>
            {store.supportEmail && (
              <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>
            )}
          </nav>

          <nav className="footer-links">
            {store.youtubeChannelUrl && (
              <a href={store.youtubeChannelUrl} target="_blank" rel="noreferrer">
                YouTube ↗
              </a>
            )}
            {store.social.instagram && (
              <a href={store.social.instagram} target="_blank" rel="noreferrer">
                Instagram ↗
              </a>
            )}
            {store.social.facebook && (
              <a href={store.social.facebook} target="_blank" rel="noreferrer">
                Facebook ↗
              </a>
            )}
            {store.social.tiktok && (
              <a href={store.social.tiktok} target="_blank" rel="noreferrer">
                TikTok ↗
              </a>
            )}
          </nav>
        </div>

        <div className="shell footer-credit">
          <span>
            © {new Date().getFullYear()} {store.storeName}
          </span>
          <span>
            Designed by{' '}
            <a href="https://octanellc.org" target="_blank" rel="noreferrer">
              Octanellc.org
            </a>
          </span>
        </div>
      </footer>
    </CartProvider>
  );
}
