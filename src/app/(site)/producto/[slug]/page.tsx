import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/AddToCart';
import { StockBadge } from '@/components/StockBadge';
import { VideoBlock } from '@/components/VideoBlock';
import { formatCents } from '@/lib/money';
import { getProductBySlug } from '@/lib/server/catalog';

export const dynamic = 'force-dynamic';

const TIER_LABEL: Record<string, string> = {
  standard: 'USPS Priority Mail',
  large: 'USPS Priority Mail (caja grande)',
  heavy: 'UPS Ground',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Figura no encontrada — Universo Figuras' };

  return {
    title: `${product.title} — Universo Figuras`,
    description: product.description.slice(0, 155),
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const image = product.images[0];

  return (
    <div className="shell">
      <div className="breadcrumb">
        <Link href="/">Tienda</Link> <span>/</span> {product.title}
      </div>

      <div className="product">
        <div>
          <div className="product__media">
            {image ? (
              <img src={image.url} alt={image.alt || product.title} />
            ) : (
              <span className="card__placeholder">Sin foto todavía</span>
            )}
          </div>

          <VideoBlock
            videoId={product.videoId}
            title={product.videoTitle}
            startSeconds={product.videoStartSeconds}
          />

          {product.description && (
            <section className="video">
              <div className="section__head">
                <h2>Sobre esta figura</h2>
              </div>
              <p className="prose">{product.description}</p>
            </section>
          )}
        </div>

        <aside className="buybox">
          {product.manufacturer && <span className="card__brand">{product.manufacturer}</span>}
          <h1>{product.title}</h1>
          {product.subtitle && <p className="buybox__note">{product.subtitle}</p>}

          <div className="buybox__price">{formatCents(product.priceCents)}</div>
          <div style={{ marginBottom: 18 }}>
            <StockBadge
              available={product.available}
              stock={product.stock}
              reserved={product.reserved}
            />
          </div>

          <AddToCart
            productId={product.id}
            available={product.available}
            stock={product.stock}
            reserved={product.reserved}
          />

          <div className="divider" />

          <dl className="specs">
            <div className="specs__row">
              <dt>Envío</dt>
              <dd>{TIER_LABEL[product.tier] ?? product.tier}</dd>
            </div>
            <div className="specs__row">
              <dt>Sale del taller en</dt>
              <dd>
                {product.handlingDays} {product.handlingDays === 1 ? 'día hábil' : 'días hábiles'}
              </dd>
            </div>
            <div className="specs__row">
              <dt>Internacional</dt>
              <dd>{product.internationalEligible ? 'Sí, vía DHL' : 'Solo EE. UU.'}</dd>
            </div>
            {product.localPickupEligible && (
              <div className="specs__row">
                <dt>Recogido en persona</dt>
                {/* Sin ubicación: el punto de encuentro se acuerda por email
                    después de la compra, no se publica. */}
                <dd>Coordinado por email</dd>
              </div>
            )}
            {product.scale && (
              <div className="specs__row">
                <dt>Escala</dt>
                <dd>{product.scale}</dd>
              </div>
            )}
            {product.line && (
              <div className="specs__row">
                <dt>Línea</dt>
                <dd>{product.line}</dd>
              </div>
            )}
            <div className="specs__row">
              <dt>Peso</dt>
              <dd>{(product.weightGrams / 1000).toFixed(2)} kg</dd>
            </div>
            <div className="specs__row">
              <dt>Caja</dt>
              <dd>
                {product.dimsMm.length} × {product.dimsMm.width} × {product.dimsMm.height} mm
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
