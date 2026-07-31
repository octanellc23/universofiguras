import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/ProductCard';
import { JsonLd } from '@/components/JsonLd';
import { VideoBlock } from '@/components/VideoBlock';
import { getPostBySlug } from '@/lib/server/blog';
import { metaDescription, SITE_NAME, SITE_URL } from '@/lib/site';
import { getProductsByIds } from '@/lib/server/catalog';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Reseña no encontrada' };

  const imagen = post.coverUrl ?? (post.videoId ? `https://i.ytimg.com/vi/${post.videoId}/maxresdefault.jpg` : null);

  return {
    title: post.title,
    description: metaDescription(post.excerpt),
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: metaDescription(post.excerpt),
      url: `${SITE_URL}/blog/${post.slug}`,
      ...(post.publishedAt ? { publishedTime: new Date(post.publishedAt).toISOString() } : {}),
      ...(imagen ? { images: [{ url: imagen, alt: post.title }] } : {}),
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const productos = await getProductsByIds(post.productIds);

  // Párrafos a partir de líneas en blanco: el dueño escribe en un textarea
  // común, no en un editor con formato.
  const parrafos = post.body.split(/\n\s*\n/).filter((parrafo) => parrafo.trim());

  return (
    <div className="shell">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: metaDescription(post.excerpt),
          ...(post.coverUrl ? { image: [post.coverUrl] } : {}),
          ...(post.publishedAt
            ? { datePublished: new Date(post.publishedAt).toISOString() }
            : {}),
          author: { '@type': 'Organization', name: SITE_NAME },
          publisher: { '@type': 'Organization', name: SITE_NAME },
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
        }}
      />

      <div className="breadcrumb">
        <Link href="/blog">Reseñas</Link> <span>/</span> {post.title}
      </div>

      <article style={{ padding: '32px 0 0', maxWidth: 760 }}>
        <h1 style={{ fontSize: 34, marginBottom: 14 }}>{post.title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, marginBottom: 10 }}>
          {post.excerpt}
        </p>
        <p style={{ color: 'var(--text-faint)', fontSize: 13.5, marginBottom: 28 }}>
          {post.readingMinutes} min de lectura
        </p>

        {post.videoId && (
          <VideoBlock videoId={post.videoId} title={post.title} startSeconds={null} />
        )}

        <div className="prose" style={{ marginTop: 32 }}>
          {parrafos.map((parrafo, index) => (
            <p key={index} style={{ marginBottom: 18 }}>
              {parrafo}
            </p>
          ))}
        </div>
      </article>

      {/* El cierre de la lectura: lo que acaba de leer, con su precio y su
          botón. Sin esto el blog es solo contenido. */}
      {productos.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>
              {productos.length === 1 ? 'La figura de esta reseña' : 'Las figuras de esta reseña'}
            </h2>
            <span>Lo que acabas de leer, disponible</span>
          </div>
          <div className="grid">
            {productos.map((producto) => (
              <ProductCard key={producto.id} product={producto} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
