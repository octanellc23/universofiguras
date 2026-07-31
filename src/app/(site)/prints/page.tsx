import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { formatCents } from '@/lib/money';
import { getFreeShippingThreshold, listPrints } from '@/lib/server/catalog';

export const metadata = {
  title: 'Prints',
  description:
    'Fotografía de colección en papel premium. Cada print captura el momento en que una figura cobra vida.',
  alternates: { canonical: '/prints' },
};

export const dynamic = 'force-dynamic';

export default async function PrintsPage() {
  const [prints, freeShippingCents] = await Promise.all([
    listPrints(),
    getFreeShippingThreshold(),
  ]);

  return (
    <div className="shell">
      <section className="section">
        <div className="section__head">
          <h2>Prints</h2>
          <span>
            {freeShippingCents
              ? `Envío gratis en Estados Unidos desde ${formatCents(freeShippingCents)}`
              : 'Fotografía de colección'}
          </span>
        </div>

        <p className="prose" style={{ marginBottom: 32 }}>
          Cada print captura el momento en que una figura cobra vida: luz, sombra y detalle en su
          máxima expresión. Papel foto premium, edición limitada, con empaque protegido para que
          llegue en perfecto estado.
        </p>

        {prints.length === 0 ? (
          <div className="empty">
            <h2>Todavía no hay prints publicados</h2>
            <p style={{ marginBottom: 24 }}>Están en camino.</p>
            <Link href="/" className="btn btn--primary">
              Ver las figuras
            </Link>
          </div>
        ) : (
          <div className="grid">
            {prints.map((print) => (
              <ProductCard key={print.id} product={print} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
