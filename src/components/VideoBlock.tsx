/**
 * El video no es un extra decorativo: es de donde viene la venta. Por eso la
 * ficha reserva el espacio aunque el video todavía no esté enlazado, en vez de
 * colapsarlo como si no existiera.
 */
export function VideoBlock({
  videoId,
  title,
  startSeconds,
}: {
  videoId: string | null;
  title: string | null;
  startSeconds: number | null;
}) {
  return (
    <section className="video">
      <div className="section__head">
        <h2>La reseña</h2>
        {title && <span>{title}</span>}
      </div>

      <div className="video__frame">
        {videoId ? (
          <iframe
            // youtube-nocookie: no planta cookies de seguimiento hasta que el
            // visitante decide darle play.
            src={`https://www.youtube-nocookie.com/embed/${videoId}${
              startSeconds ? `?start=${startSeconds}` : ''
            }`}
            title={title ?? 'Reseña en video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="video__empty">
            <span style={{ fontSize: 26 }}>▶</span>
            <span>Aquí va el video de la reseña</span>
            <small>Se enlaza desde el panel, pegando el link de YouTube.</small>
          </div>
        )}
      </div>
    </section>
  );
}
