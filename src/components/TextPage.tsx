/**
 * Página de texto: nosotros, devoluciones, envíos.
 *
 * Los párrafos se separan por líneas en blanco, que es como escribe cualquiera
 * sin pensar en formato. No usamos markdown completo: sería una dependencia
 * más y un lenguaje que el dueño tendría que aprender para escribir tres
 * párrafos.
 */
export function TextPage({
  titulo,
  texto,
  vacio,
}: {
  titulo: string;
  texto: string;
  vacio: string;
}) {
  const parrafos = texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="shell">
      <article style={{ maxWidth: 700, padding: '48px 0 0' }}>
        <h1 style={{ fontSize: 32, marginBottom: 24 }}>{titulo}</h1>

        {parrafos.length === 0 ? (
          <p className="prose">{vacio}</p>
        ) : (
          <div className="prose">
            {parrafos.map((parrafo, index) => (
              <p key={index} style={{ marginBottom: 18, whiteSpace: 'pre-wrap' }}>
                {parrafo}
              </p>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
