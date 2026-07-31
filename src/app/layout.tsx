import type { Metadata } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  // Sin metadataBase, las imágenes de Open Graph salen con rutas relativas y
  // ni Google ni WhatsApp las resuelven.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — figuras de acción coleccionables`,
    // Cada página pone solo su nombre; el resto lo agrega esta plantilla.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'es_US',
    url: SITE_URL,
    title: `${SITE_NAME} — figuras de acción coleccionables`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — figuras de acción coleccionables`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Sin esto Google recorta la miniatura, y en una tienda de figuras la
      // foto es medio argumento de venta.
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

/**
 * Raíz mínima. El encabezado y el carrito viven en (site); el panel tiene su
 * propio chrome y no debe arrastrar la barra de la tienda.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
