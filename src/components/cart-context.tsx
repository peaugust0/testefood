"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FulfillmentType, OrderItem, Product } from "@/lib/types";
import { cartSubtotal, uid } from "@/lib/utils";

export type CartLine = OrderItem & { key: string };

type CartContextValue = {
  items: CartLine[];
  fulfillment: FulfillmentType;
  setFulfillment: (f: FulfillmentType) => void;
  addProduct: (
    product: Product,
    opts?: { qty?: number; extras?: OrderItem["extras"]; notes?: string }
  ) => void;
  updateQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  subtotal: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "burgerhouse_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("delivery");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.items ?? []);
        setFulfillment(parsed.fulfillment ?? "delivery");
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items, fulfillment })
    );
  }, [items, fulfillment, hydrated]);

  const addProduct = useCallback(
    (
      product: Product,
      opts?: { qty?: number; extras?: OrderItem["extras"]; notes?: string }
    ) => {
      const line: CartLine = {
        key: uid("line"),
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        qty: opts?.qty ?? 1,
        extras: opts?.extras,
        notes: opts?.notes,
      };
      setItems((prev) => [...prev, line]);
    },
    []
  );

  const updateQty = useCallback((key: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty } : i))
        .filter((i) => i.qty > 0)
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotal = useMemo(() => cartSubtotal(items), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);

  const value = useMemo(
    () => ({
      items,
      fulfillment,
      setFulfillment,
      addProduct,
      updateQty,
      removeItem,
      clear,
      subtotal,
      count,
    }),
    [
      items,
      fulfillment,
      addProduct,
      updateQty,
      removeItem,
      clear,
      subtotal,
      count,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
