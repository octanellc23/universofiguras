'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * El carrito guarda SOLO {productId, qty} (I1). Ni títulos ni precios: todo
 * eso se vuelve a pedir al servidor en cada cotización, así que un carrito
 * viejo nunca puede resucitar un precio viejo.
 */
export interface CartLine {
  productId: string;
  qty: number;
}

const STORAGE_KEY = 'uf_cart_v1';
const MAX_QTY = 10;

interface CartContextValue {
  lines: CartLine[];
  ready: boolean;
  count: number;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is CartLine =>
        typeof (line as CartLine)?.productId === 'string' &&
        typeof (line as CartLine)?.qty === 'number'
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  // El carrito vive en localStorage, que no existe durante el render del
  // servidor: se lee después de montar para no romper la hidratación.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(read());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  const add = useCallback((productId: string, qty = 1) => {
    setLines((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (!existing) return [...current, { productId, qty }];
      return current.map((line) =>
        line.productId === productId
          ? { ...line, qty: Math.min(MAX_QTY, line.qty + qty) }
          : line
      );
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setLines((current) =>
      qty <= 0
        ? current.filter((line) => line.productId !== productId)
        : current.map((line) =>
            line.productId === productId
              ? { ...line, qty: Math.min(MAX_QTY, qty) }
              : line
          )
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((sum, line) => sum + line.qty, 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [lines, ready, add, setQty, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider');
  return context;
}
