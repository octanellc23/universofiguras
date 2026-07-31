/**
 * Datos estructurados (schema.org). Es lo que hace que Google muestre el
 * precio y el "en stock" debajo del resultado en vez de una línea de texto
 * cualquiera — para una tienda es la diferencia entre un clic y un scroll.
 *
 * Va como JSON dentro de un <script>, así que no se renderiza nada visible.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // El contenido es JSON que generamos nosotros desde Firestore, no
      // entrada de un tercero.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
