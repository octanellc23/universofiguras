import { CartClient } from './CartClient';
import { getShippingCountries } from '@/lib/server/catalog';

// El carrito es de una sola persona: no hay nada que indexar.
export const metadata = { title: 'Tu carrito', robots: { index: false, follow: true } };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  // La lista de países sale de config/shipping: si el dueño agrega una banda,
  // aparece aquí sin tocar código.
  const countries = await getShippingCountries();

  return (
    <div className="shell">
      <div className="breadcrumb">Tu carrito</div>
      <CartClient countries={countries} />
    </div>
  );
}
