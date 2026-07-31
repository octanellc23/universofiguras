import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // El panel y las rutas internas no tienen por qué aparecer en Google.
        // El carrito y la confirmación tampoco: son páginas de una sola
        // persona, y un pedido indexado sería una filtración.
        disallow: ['/admin', '/api', '/carrito', '/pedido'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
