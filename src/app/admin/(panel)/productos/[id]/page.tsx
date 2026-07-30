import { notFound } from 'next/navigation';
import { getProductForEdit } from '@/lib/server/admin-catalog';
import { ProductForm } from './ProductForm';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // "nuevo" no es un ID: es la señal de que el formulario arranca en blanco.
  if (id === 'nuevo') return <ProductForm product={null} />;

  const product = await getProductForEdit(id);
  if (!product) notFound();

  return <ProductForm product={product} />;
}
