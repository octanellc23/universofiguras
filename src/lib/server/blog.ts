import { adminDb } from './admin';

export interface PostView {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string | null;
  videoId: string | null;
  readingMinutes: number;
  publishedAt: number | null;
}

interface RawPost {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: { url: string } | null;
  videoId: string | null;
  readingMinutes: number;
  publishedAt: { toMillis(): number } | null;
}

function toView(id: string, raw: RawPost): PostView {
  return {
    id,
    slug: raw.slug,
    title: raw.title,
    excerpt: raw.excerpt ?? '',
    body: raw.body ?? '',
    coverUrl: raw.coverImage?.url ?? null,
    videoId: raw.videoId ?? null,
    readingMinutes: raw.readingMinutes ?? 3,
    // Los Timestamp de Firestore no cruzan la frontera servidor→cliente.
    publishedAt: raw.publishedAt ? raw.publishedAt.toMillis() : null,
  };
}

export async function listPublishedPosts(max = 20): Promise<PostView[]> {
  const snap = await adminDb
    .collection('posts')
    .where('status', '==', 'published')
    .orderBy('publishedAt', 'desc')
    .limit(max)
    .get();

  return snap.docs.map((doc) => toView(doc.id, doc.data() as RawPost));
}

export async function getPostBySlug(slug: string): Promise<PostView | null> {
  const snap = await adminDb
    .collection('posts')
    .where('status', '==', 'published')
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return toView(snap.docs[0].id, snap.docs[0].data() as RawPost);
}
