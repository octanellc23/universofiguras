'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/lib/client/cart';

export function AddToCart({
  productId,
  available,
  stock,
  reserved,
}: {
  productId: string;
  available: number;
  stock: number;
  reserved: number;
}) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (available <= 0) {
    // Apartada, no agotada: la compra de otra persona puede no completarse y
    // la unidad vuelve sola. Vale mucho más decir esto que "Agotado".
    if (stock > 0 && reserved > 0) {
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn btn--ghost btn--block" disabled>
            Alguien la está comprando
          </button>
          <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>
            Es la última unidad y hay una compra en curso. Si no se completa, vuelve a estar
            disponible en unos 30 minutos.
          </span>
        </div>
      );
    }

    return (
      <button className="btn btn--ghost btn--block" disabled>
        Agotado
      </button>
    );
  }

  // El tope es el stock real: no tiene sentido dejar pedir 5 de algo de lo que
  // hay 2, para que después la reserva lo rechace en el checkout.
  const max = Math.min(available, 10);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="stepper">
          <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={qty <= 1}>
            −
          </button>
          <span>{qty}</span>
          <button type="button" onClick={() => setQty((n) => Math.min(max, n + 1))} disabled={qty >= max}>
            +
          </button>
        </div>
        <span style={{ color: 'var(--text-faint)', fontSize: 13.5 }}>
          {available === 1 ? 'Queda 1 unidad' : `Quedan ${available} unidades`}
        </span>
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={() => {
          add(productId, qty);
          setAdded(true);
        }}
      >
        Agregar al carrito
      </button>

      {added && (
        <Link href="/carrito" className="btn btn--ghost btn--block">
          Ir al carrito →
        </Link>
      )}
    </div>
  );
}
