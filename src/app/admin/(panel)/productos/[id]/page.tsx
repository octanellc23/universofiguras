import { notFound } from 'next/navigation';
import { getProductForEdit } from '@/lib/server/admin-catalog';
import { ProductForm } from './ProductForm';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const [{ id }, { tipo }] = await Promise.all([params, searchParams]);

  // "nuevo" no es un ID: es la señal de que el formulario arranca en blanco.
  // ?tipo=print lo arranca configurado como lámina, para que no haya que
  // acordarse de cuatro casillas cada vez.
  if (id === 'nuevo') {
    return <ProductForm product={null} tipo={tipo === 'print' ? 'print' : 'figura'} />;
  }

  const product = await getProductForEdit(id);
  if (!product) notFound();

  return <ProductForm product={product} tipo="figura" />;
}
