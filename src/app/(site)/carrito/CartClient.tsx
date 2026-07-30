'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/client/cart';
import { callFunction } from '@/lib/client/firebase';
import { formatCents } from '@/lib/money';
import type { CartQuoteView, CountryOption } from '@/lib/types';

function messageOf(error: unknown): string {
  // Los HttpsError del backend ya vienen en español y escritos para un
  // comprador; se muestran tal cual.
  return error instanceof Error
    ? error.message
    : 'No pudimos calcular tu pedido. Intenta de nuevo.';
}

export function CartClient({ countries }: { countries: CountryOption[] }) {
  const { lines, ready, setQty, remove, clear } = useCart();
  const [country, setCountry] = useState('US');
  const [quote, setQuote] = useState<CartQuoteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      setQuote(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    callFunction<{ items: typeof lines; country: string }, CartQuoteView>('quoteCart', {
      items: lines,
      country,
    })
      .then((result) => {
        if (cancelled) return;
        setQuote(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // No borramos la cotización anterior: si el comprador acaba de elegir
        // un país que rechaza su carrito, necesita seguir viendo los artículos
        // para poder quitar el que estorba.
        setError(messageOf(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lines, country, ready]);

  if (!ready) {
    return <div className="empty">Cargando tu carrito…</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="empty">
        <h2>Tu carrito está vacío</h2>
        <p style={{ marginBottom: 24 }}>Todo lo que reseñamos en el canal está en la tienda.</p>
        <Link href="/" className="btn btn--primary">
          Ver las figuras
        </Link>
      </div>
    );
  }

  const delivery = quote?.options.find((option) => option.method !== 'pickup') ?? null;
  const pickup = quote?.options.find((option) => option.method === 'pickup') ?? null;
  const totalCents =
    quote && delivery && !error ? quote.subtotalCents + delivery.amountCents : null;

  return (
    <div className="cart">
      <div>
        {quote?.items.map((item) => (
          <div key={item.productId} className="cart__line">
            <div className="cart__thumb">
              {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
            </div>

            <div>
              <Link href={`/producto/${item.slug}`} style={{ fontWeight: 600 }}>
                {item.title}
              </Link>
              <div style={{ color: 'var(--text-faint)', fontSize: 13.5, marginTop: 2 }}>
                {formatCents(item.unitPriceCents)} c/u
              </div>
              {item.qty > item.available && (
                <div style={{ color: 'var(--warning)', fontSize: 13, marginTop: 4 }}>
                  Solo quedan {item.available}
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(item.productId)}
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  marginTop: 6,
                  color: 'var(--text-faint)',
                  fontSize: 13,
                  textDecoration: 'underline',
                }}
              >
                Quitar
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
              <div className="stepper">
                <button type="button" onClick={() => setQty(item.productId, item.qty - 1)}>
                  −
                </button>
                <span>{item.qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(item.productId, item.qty + 1)}
                  disabled={item.qty >= item.available}
                >
                  +
                </button>
              </div>
              <span className="price price--sm">{formatCents(item.lineTotalCents)}</span>
            </div>
          </div>
        ))}

        {!quote && loading && <div className="empty">Calculando…</div>}
      </div>

      <aside className="summary">
        <h2>Resumen</h2>

        {error && <div className="notice notice--error">{error}</div>}

        {/* Si la cotización falla y no hay una anterior que mostrar, el
            comprador se queda sin artículos en pantalla y sin forma de
            arreglar el carrito: por ejemplo si el dueño archivó una figura que
            alguien tenía guardada. Esta es la salida de emergencia. */}
        {error && !quote && (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginBottom: 16 }}
            onClick={clear}
          >
            Vaciar el carrito y empezar de nuevo
          </button>
        )}

        <label className="field">
          <span className="field__label">País de entrega</span>
          <select
            className="select"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            {countries.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        {/* El país se pide ACÁ y no en Stripe porque Stripe fija el costo de
            envío al crear la sesión y ya no lo recalcula (I7). */}
        <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: -8, marginBottom: 16 }}>
          Lo pedimos antes de pagar para calcular el envío exacto.
        </p>

        {delivery && !error && (
          <div className="option-list">
            <div className="option">
              <div>
                <strong>{delivery.label}</strong>
                {delivery.deliveryDays && (
                  <small>
                    {delivery.deliveryDays.min}–{delivery.deliveryDays.max} días hábiles
                  </small>
                )}
              </div>
              <span>
                {delivery.amountCents === 0 ? 'Gratis' : formatCents(delivery.amountCents)}
              </span>
            </div>
            {pickup && (
              <div className="option">
                <div>
                  <strong>{pickup.label}</strong>
                  <small>Podrás elegirlo al pagar</small>
                </div>
                <span>Gratis</span>
              </div>
            )}
          </div>
        )}

        {quote && !error && (
          <>
            <div className="summary__row">
              <span>Subtotal</span>
              <span>{formatCents(quote.subtotalCents)}</span>
            </div>
            <div className="summary__row">
              <span>Envío</span>
              <span>
                {delivery?.amountCents === 0 ? 'Gratis' : formatCents(delivery?.amountCents ?? 0)}
              </span>
            </div>
            <div className="summary__row">
              <span>Impuestos</span>
              <span>Se calculan al pagar</span>
            </div>
            <div className="summary__row summary__row--total">
              <span>Total</span>
              <span>{totalCents !== null ? formatCents(totalCents) : '—'}</span>
            </div>
          </>
        )}

        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginTop: 18 }}
          disabled={paying || loading || !!error || !quote}
          onClick={async () => {
            setPaying(true);
            setError(null);
            try {
              const session = await callFunction<
                { items: typeof lines; country: string },
                { url: string }
              >('createCheckout', { items: lines, country });
              window.location.href = session.url;
            } catch (err: unknown) {
              setError(messageOf(err));
              setPaying(false);
            }
          }}
        >
          {paying ? 'Abriendo el pago…' : 'Pagar'}
        </button>

        <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 12 }}>
          El pago lo procesa Stripe. Apartamos tus unidades 30 minutos mientras completas la
          compra.
        </p>
      </aside>
    </div>
  );
}
