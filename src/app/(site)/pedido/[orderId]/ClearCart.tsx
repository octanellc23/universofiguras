'use client';

import { useEffect } from 'react';
import { useCart } from '@/lib/client/cart';

/**
 * A esta página solo se llega desde el success_url de Stripe. Si el comprador
 * cancela, vuelve a /carrito y su carrito sigue intacto.
 */
export function ClearCart() {
  const { clear, ready } = useCart();

  useEffect(() => {
    if (ready) clear();
  }, [ready, clear]);

  return null;
}
