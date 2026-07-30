import { notFound } from 'next/navigation';
import { getPostForEdit, listAllProducts } from '@/lib/server/admin-catalog';
import { PostForm } from './PostForm';

export const dynamic = 'force-dynamic';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const productos = (await listAllProducts()).map((product) => ({
    id: product.id,
    title: product.title,
    status: product.status,
  }));

  if (id === 'nuevo') return <PostForm post={null} productos={productos} />;

  const post = await getPostForEdit(id);
  if (!post) notFound();

  return <PostForm post={post} productos={productos} />;
}
