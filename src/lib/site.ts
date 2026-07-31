/** Dominio canónico. Todo lo que Google indexa cuelga de aquí. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://universofiguras.com'
).replace(/\/$/, '');

export const SITE_NAME = 'Universo Figuras';

export const SITE_DESCRIPTION =
  'Figuras de acción coleccionables reseñadas en video, una por una. Envíos a Estados Unidos y Latinoamérica.';

/**
 * Descripción para buscadores a partir de un texto libre.
 *
 * Google la muestra tal cual sale de aquí, así que hay que aplanar los saltos
 * de línea —si no, el resultado aparece partido— y cortar en un espacio, no a
 * mitad de palabra.
 */
export function metaDescription(texto: string, limite = 155): string {
  const plano = texto.replace(/\s+/g, ' ').trim();
  if (plano.length <= limite) return plano;

  const corte = plano.slice(0, limite);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${(ultimoEspacio > limite * 0.6 ? corte.slice(0, ultimoEspacio) : corte).trim()}…`;
}
