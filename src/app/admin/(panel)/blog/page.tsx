import Link from 'next/link';
import { listAllPosts } from '@/lib/server/admin-catalog';

export const metadata = { title: 'Reseñas — Panel' };
export const dynamic = 'force-dynamic';

const ESTADO: Record<string, { texto: string; clase: string }> = {
  published: { texto: 'Publicada', clase: 'badge--stock' },
  draft: { texto: 'Borrador', clase: 'badge--low' },
  archived: { texto: 'Archivada', clase: 'badge--out' },
};

export default async function AdminBlogPage() {
  const posts = await listAllPosts();

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Reseñas</h1>
          <p className="panel__hint">
            {posts.length} en total · {posts.filter((p) => p.status === 'published').length}{' '}
            publicadas
          </p>
        </div>
        <Link href="/admin/blog/nuevo" className="btn btn--primary">
          + Nueva reseña
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="empty">
          <h2>Todavía no hay reseñas escritas</h2>
          <p style={{ marginBottom: 24 }}>
            Una reseña enlazada a sus figuras es lo que convierte una visita en una compra.
          </p>
          <Link href="/admin/blog/nuevo" className="btn btn--primary">
            Escribir la primera
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reseña</th>
                <th>Estado</th>
                <th>Figuras</th>
                <th>Video</th>
                <th>Última edición</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const estado = ESTADO[post.status] ?? ESTADO.draft;
                return (
                  <tr key={post.id}>
                    <td>
                      <Link href={`/admin/blog/${post.id}`} className="table__link">
                        {post.title}
                      </Link>
                      <div className="table__sub">/{post.slug}</div>
                    </td>
                    <td>
                      <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                    </td>
                    <td className="table__num">{post.productCount || '—'}</td>
                    <td>{post.hasVideo ? '▶' : '—'}</td>
                    <td className="table__sub">
                      {post.updatedAt
                        ? new Date(post.updatedAt).toLocaleDateString('es', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
