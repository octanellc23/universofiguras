import { ProductCard } from '@/components/ProductCard';
import { formatCents } from '@/lib/money';
import { getFreeShippingThreshold, listActiveProducts } from '@/lib/server/catalog';

// El stock cambia mientras la gente compra: cachear el catálogo mostraría
// "disponible" sobre unidades que ya se fueron.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [products, freeShippingCents] = await Promise.all([
    listActiveProducts(),
    getFreeShippingThreshold(),
  ]);

  return (
    <>
      <section className="hero">
        <div className="shell">
          <span className="hero__eyebrow">▶ Cada figura, reseñada en video</span>
          <h1>Figuras que primero se ven, y después se tienen.</h1>
          <p>
            Coleccionables seleccionados uno por uno y reseñados en el canal. La figura que ves
            en el video es exactamente la que llega a tu casa.
          </p>
        </div>
      </section>

      <div className="shell">
        <section className="section">
          <div className="section__head">
            <h2>En la tienda</h2>
            <span>
              {freeShippingCents
                ? `Envío gratis en Estados Unidos desde ${formatCents(freeShippingCents)}`
                : `${products.length} ${products.length === 1 ? 'figura' : 'figuras'}`}
            </span>
          </div>

          {products.length === 0 ? (
            <div className="empty">
              <h2>Todavía no hay figuras publicadas</h2>
              <p>Vuelve pronto — o mejor, suscríbete al canal para enterarte primero.</p>
            </div>
          ) : (
            <div className="grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
