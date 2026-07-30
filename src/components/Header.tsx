'use client';

import Link from 'next/link';
import { useCart } from '@/lib/client/cart';

export function Header() {
  const { count, ready } = useCart();

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link href="/" className="logo">
          <span className="logo__mark">◆</span> Universo Figuras
        </Link>

        <nav className="nav">
          <Link href="/">Tienda</Link>
          <Link href="/blog">Reseñas</Link>
        </nav>

        <Link href="/carrito" className="cart-link">
          Carrito
          {/* Hasta que no monta no sabemos qué hay en localStorage; pintar un 0
              antes provocaría un parpadeo en cada carga. */}
          {ready && count > 0 && <span className="cart-link__count">{count}</span>}
        </Link>
      </div>
    </header>
  );
}
