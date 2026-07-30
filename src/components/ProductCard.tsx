import Link from 'next/link';
import { formatCents } from '@/lib/money';
import type { ProductView } from '@/lib/types';
import { StockBadge } from './StockBadge';

export function ProductCard({ product }: { product: ProductView }) {
  const image = product.images[0];

  return (
    <Link href={`/producto/${product.slug}`} className="card">
      <div className="card__media">
        {image ? (
          // <img> y no next/image: mientras no haya fotos reales en Storage no
          // vale la pena pagar la optimización ni arriesgar un 500 por un
          // dominio no permitido.
          <img src={image.url} alt={image.alt || product.title} loading="lazy" />
        ) : (
          <span className="card__placeholder">Sin foto</span>
        )}
        {product.videoId && <span className="badge badge--video">▶ Reseña</span>}
      </div>

      <div className="card__body">
        {product.manufacturer && <span className="card__brand">{product.manufacturer}</span>}
        <span className="card__title">{product.title}</span>
        <div className="card__foot">
          <span className="price">{formatCents(product.priceCents)}</span>
          <StockBadge
            available={product.available}
            stock={product.stock}
            reserved={product.reserved}
          />
        </div>
      </div>
    </Link>
  );
}
