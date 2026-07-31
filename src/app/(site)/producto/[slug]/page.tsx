import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/AddToCart';
import { CondicionAviso } from '@/components/CondicionAviso';
import { JsonLd } from '@/components/JsonLd';
import { StockBadge } from '@/components/StockBadge';
import { VideoBlock } from '@/components/VideoBlock';
import { formatCents } from '@/lib/money';
import { getProductBySlug } from '@/lib/server/catalog';
import { metaDescription, SITE_NAME, SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

const TIER_LABEL: Record<string, string> = {
  print: 'USPS Ground Advantage',
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
  if (!product) return { title: 'Figura no encontrada' };

  // Si no hay descripción escrita, una frase armada vale más que un vacío:
  // Google usa esto como resumen del resultado.
  const description =
    metaDescription(product.description) ||
    `${product.title}${product.manufacturer ? ` de ${product.manufacturer}` : ''} — ${formatCents(
      product.priceCents
    )}. Reseñada en video y enviada desde Estados Unidos.`;

  const imagen = product.images[0]?.url;

  return {
    title: product.title,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.title,
      description,
      url: `${SITE_URL}/producto/${product.slug}`,
      ...(imagen ? { images: [{ url: imagen, alt: product.title }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const image = product.images[0];
  const url = `${SITE_URL}/producto/${product.slug}`;

  const CONDICION: Record<string, string> = {
    new: 'https://schema.org/NewCondition',
    openbox: 'https://schema.org/NewCondition',
    used: 'https://schema.org/UsedCondition',
  };

  return (
    <div className="shell">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.title,
          description: product.description || product.title,
          image: product.images.map((img) => img.url),
          ...(product.manufacturer
            ? { brand: { '@type': 'Brand', name: product.manufacturer } }
            : {}),
          ...(product.scale ? { size: product.scale } : {}),
          weight: { '@type': 'QuantitativeValue', value: product.weightGrams, unitCode: 'GRM' },
          offers: {
            '@type': 'Offer',
            url,
            priceCurrency: 'USD',
            // schema.org quiere el precio como número decimal, no como texto
            // con símbolo.
            price: (product.priceCents / 100).toFixed(2),
            itemCondition: CONDICION[product.condition] ?? CONDICION.new,
            availability:
              product.available > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: SITE_NAME },
          },
        }}
      />

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tienda', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: product.title, item: url },
          ],
        }}
      />

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
          <div>
            <StockBadge
              available={product.available}
              stock={product.stock}
              reserved={product.reserved}
            />
          </div>

          {/* Antes del botón, no después: quien compra tiene que verlo sí o sí.
              En una lámina no aplica: no hay caja que abrir. */}
          {product.tier !== 'print' && <CondicionAviso condition={product.condition} />}

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
