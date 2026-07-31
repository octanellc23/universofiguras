import type { MetadataRoute } from 'next';
import { listPublishedPosts } from '@/lib/server/blog';
import { listActiveProducts } from '@/lib/server/catalog';
import { getStoreContent } from '@/lib/server/store';
import { SITE_URL } from '@/lib/site';

/**
 * Sitemap que se arma solo desde Firestore: cada figura publicada y cada
 * reseña entran sin que nadie tenga que acordarse de agregarlas.
 *
 * No incluye carrito, pedido ni panel: no son páginas para buscar.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productos, posts, store] = await Promise.all([
    listActiveProducts(200),
    listPublishedPosts(200),
    getStoreContent(),
  ]);

  const ahora = new Date();

  const fijas: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: ahora, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/blog`, lastModified: ahora, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/envios`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/devoluciones`, lastModified: ahora, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Nosotros solo entra cuando tiene contenido: ofrecerle a Google una página
  // vacía es pedirle que la juzgue.
  if (store.about) {
    fijas.push({
      url: `${SITE_URL}/nosotros`,
      lastModified: ahora,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  return [
    ...fijas,
    ...productos.map((producto) => ({
      url: `${SITE_URL}/producto/${producto.slug}`,
      lastModified: ahora,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.publishedAt ? new Date(post.publishedAt) : ahora,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
