import Link from 'next/link';
import { listPublishedPosts } from '@/lib/server/blog';

export const metadata = { title: 'Reseñas — Universo Figuras' };
export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  const posts = await listPublishedPosts();

  return (
    <div className="shell">
      <section className="section">
        <div className="section__head">
          <h2>Reseñas</h2>
          <span>Lo que hay detrás de cada figura</span>
        </div>

        {posts.length === 0 ? (
          <div className="empty">
            <h2>Todavía no hay reseñas publicadas</h2>
            <p>Las entradas del blog se escriben desde el panel y se enlazan a cada figura.</p>
          </div>
        ) : (
          <div className="grid">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="card">
                <div className="card__media">
                  {post.coverUrl ? (
                    <img src={post.coverUrl} alt={post.title} loading="lazy" />
                  ) : (
                    <span className="card__placeholder">Reseña</span>
                  )}
                  {post.videoId && <span className="badge badge--video">▶ Video</span>}
                </div>
                <div className="card__body">
                  <span className="card__title">{post.title}</span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 13.5 }}>
                    {post.excerpt}
                  </span>
                  <span className="card__brand" style={{ marginTop: 'auto' }}>
                    {post.readingMinutes} min de lectura
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
