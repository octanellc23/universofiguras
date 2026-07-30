import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VideoBlock } from '@/components/VideoBlock';
import { getPostBySlug } from '@/lib/server/blog';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Reseña no encontrada — Universo Figuras' };
  return { title: `${post.title} — Universo Figuras`, description: post.excerpt };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="shell">
      <div className="breadcrumb">
        <Link href="/blog">Reseñas</Link> <span>/</span> {post.title}
      </div>

      <article style={{ padding: '32px 0 0', maxWidth: 760 }}>
        <h1 style={{ fontSize: 34, marginBottom: 14 }}>{post.title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, marginBottom: 28 }}>
          {post.excerpt}
        </p>

        {post.videoId && (
          <VideoBlock videoId={post.videoId} title={post.title} startSeconds={null} />
        )}

        <div className="prose" style={{ marginTop: 32, whiteSpace: 'pre-wrap' }}>
          {post.body}
        </div>
      </article>
    </div>
  );
}
