import { Header } from '@/components/Header';
import { CartProvider } from '@/lib/client/cart';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Header />
      <main>{children}</main>
      <footer className="site-footer">
        <div className="shell">
          Universo Figuras · Envíos a Estados Unidos y Latinoamérica
        </div>
      </footer>
    </CartProvider>
  );
}
