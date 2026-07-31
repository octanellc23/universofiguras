/**
 * Aviso de condición de la figura.
 *
 * El dueño abre y reseña casi todo lo que vende, y eso NO es obvio para quien
 * compra por primera vez: un coleccionista que espera una caja sellada y
 * recibe una abierta abre una disputa, y esa disputa se pierde. Por eso el
 * aviso es imposible de pasar por alto y va ANTES del botón de comprar, no en
 * la letra chica de abajo.
 *
 * La regla es "abierta y reseñada, salvo que la ficha diga lo contrario": la
 * excepción la marca el propio producto con su condición.
 */
export function CondicionAviso({ condition }: { condition: string }) {
  if (condition === 'new') {
    return (
      <div className="aviso aviso--sellada">
        <span className="aviso__icono">✓</span>
        <div>
          <strong>Sellada, sin abrir.</strong>
          <span>Esta figura llega en su caja original cerrada.</span>
        </div>
      </div>
    );
  }

  const usada = condition === 'used';

  return (
    <div className="aviso aviso--abierta">
      <span className="aviso__icono">!</span>
      <div>
        <strong>{usada ? 'Figura usada.' : 'Caja abierta y reseñada.'}</strong>
        <span>
          {usada
            ? 'Estuvo fuera de la caja y se muestra tal cual está en el video. No es una pieza sellada.'
            : 'Se abrió para reseñarla en video. La figura está completa y en perfecto estado, pero la caja NO viene sellada.'}
        </span>
      </div>
    </div>
  );
}
