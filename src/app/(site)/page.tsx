import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { ProductCard } from '@/components/ProductCard';
import { formatCents } from '@/lib/money';
import { getFreeShippingThreshold, listActiveProducts } from '@/lib/server/catalog';
import { getStoreContent } from '@/lib/server/store';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata = {
  // Frase que la gente sí busca: "tienda oficial de <canal>". Va absoluta
  // para que no se le pegue el sufijo de la plantilla.
  title: { absolute: "Tienda oficial de Lokillo's Hidden Gems" },
  description:
    "La tienda oficial de Lokillo's Hidden Gems: figuras de acción coleccionables reseñadas en video, una por una. Envíos a Estados Unidos y Latinoamérica.",
  alternates: { canonical: '/' },
};

// El stock cambia mientras la gente compra: cachear el catálogo mostraría
// "disponible" sobre unidades que ya se fueron.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [todos, freeShippingCents, store] = await Promise.all([
    listActiveProducts(),
    getFreeShippingThreshold(),
    getStoreContent(),
  ]);

  // Las láminas tienen su propia página: mezclarlas con las figuras en la
  // portada confunde dos cosas que se compran por razones distintas.
  const products = todos.filter((p) => !p.categories.includes('prints'));
  const hayPrints = todos.length > products.length;

  // sameAs le dice a Google que esta tienda y ese canal de YouTube son la
  // misma entidad. Es lo que hace que buscar el nombre del canal traiga
  // también la tienda.
  const redes = [
    store.youtubeChannelUrl,
    store.social.instagram,
    store.social.facebook,
    store.social.tiktok,
    store.social.x,
  ].filter((enlace): enlace is string => Boolean(enlace));

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Store',
          name: store.storeName || SITE_NAME,
          description: SITE_DESCRIPTION,
          url: SITE_URL,
          ...(redes.length > 0 ? { sameAs: redes } : {}),
          ...(store.supportEmail ? { email: store.supportEmail } : {}),
        }}
      />

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: store.storeName || SITE_NAME,
          url: SITE_URL,
        }}
      />

      <section className="hero hero--centrado">
        <div className="shell">
          <span className="hero__eyebrow">▶ Cada figura, reseñada en video</span>

          {/* El h1 es la frase completa: "Tienda oficial de Lokillo's Hidden
              Gems". El nombre lo aporta el alt de la imagen, así que Google y
              los lectores de pantalla la leen entera aunque el logo sea un
              gráfico. */}
          <h1 className="hero__titulo">
            <span className="hero__titulo-texto">Tienda oficial de</span>
            {/* WebP con PNG de respaldo: el logo tiene textura granulada y en
                PNG pesaba 709 KB para mostrarse a 340 px. En WebP son 48. */}
            <picture className="hero__logo">
              <source srcSet="/logo.webp" type="image/webp" />
              <img
                src="/logo.png"
                alt="Lokillo's Hidden Gems"
                // Tamaño real del arte tras recortar el fondo. El original que
                // nos pasaron es chico: mostrarlo más grande que esto lo pone
                // borroso.
                width={474}
                height={249}
                // Es lo primero que se ve: cargarla con prioridad evita que el
                // hero salte cuando aparece.
                fetchPriority="high"
              />
            </picture>
          </h1>

          <p>
            Coleccionables seleccionados uno por uno y reseñados en el canal. La figura que ves
            en el video es exactamente la que llega a tu casa.
          </p>

          {store.youtubeChannelUrl && (
            <a
              href={store.youtubeChannelUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost hero__canal"
            >
              Ver el canal ↗
            </a>
          )}
        </div>
      </section>

      <div className="shell">
        <section className="section">
          <div className="section__head">
            <h2>Figuras</h2>
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

        {hayPrints && (
          <section className="section">
            <div className="promo">
              <div>
                <h2>Prints de la colección</h2>
                <p>
                  Fotografía de colección en papel premium. Edición limitada, del 8x10 al póster
                  de 24x36.
                </p>
              </div>
              <Link href="/prints" className="btn btn--primary">
                Ver los prints
              </Link>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
