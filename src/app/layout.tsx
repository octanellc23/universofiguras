import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Universo Figuras — figuras de acción coleccionables',
  description:
    'Figuras de acción coleccionables reseñadas en video. Envíos a Estados Unidos y Latinoamérica.',
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
