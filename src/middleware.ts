import { NextResponse, type NextRequest } from 'next/server';

/**
 * www.universofiguras.com → universofiguras.com
 *
 * Servir el mismo contenido en los dos dominios le da a Google dos sitios
 * idénticos y reparte la autoridad entre ambos. Todas las canónicas del sitio
 * apuntan al dominio sin www, así que ese es el bueno y el otro redirige.
 *
 * 308 y no 302: es permanente, y a diferencia del 301 conserva el método, así
 * que un POST que llegue por error a www no se convierte en GET.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  if (!host || !host.startsWith('www.')) return;

  // Se arma desde la cabecera Host y no desde request.url: detrás de Cloud Run
  // esa URL trae el host interno, no el que escribió el visitante.
  const destino = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    `https://${host.slice(4)}`
  );

  return NextResponse.redirect(destino, 308);
}

export const config = {
  // Ni los archivos internos de Next ni los estáticos: no hace falta
  // redirigirlos y encarece cada carga.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)'],
};
