import type {
  Coupon,
  FulfillmentType,
  OpeningHours,
  OrderItem,
  RestaurantSettings,
} from "./types";

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function itemTotal(item: OrderItem): number {
  const extras = (item.extras ?? []).reduce((s, e) => s + e.price, 0);
  return (item.unitPrice + extras) * item.qty;
}

export function cartSubtotal(items: OrderItem[]): number {
  return items.reduce((s, i) => s + itemTotal(i), 0);
}

export function applyCoupon(
  coupon: Coupon | undefined,
  subtotal: number
): number {
  if (!coupon || !coupon.active) return 0;
  if (subtotal < coupon.minOrder) return 0;
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return 0;
  if (coupon.type === "percent") {
    return Math.round(subtotal * (coupon.value / 100) * 100) / 100;
  }
  return Math.min(coupon.value, subtotal);
}

export function calcOrderTotals(params: {
  items: OrderItem[];
  fulfillment: FulfillmentType;
  deliveryFee: number;
  coupon?: Coupon;
}) {
  const subtotal = cartSubtotal(params.items);
  const deliveryFee =
    params.fulfillment === "delivery" ? params.deliveryFee : 0;
  const discount = applyCoupon(params.coupon, subtotal);
  const total = Math.max(0, subtotal + deliveryFee - discount);
  return { subtotal, deliveryFee, discount, total };
}

export function isOpenNow(
  hours: OpeningHours[],
  now = new Date()
): { open: boolean; label: string } {
  const day = now.getDay();
  const entry = hours.find((h) => h.day === day);
  if (!entry || entry.closed) {
    return { open: false, label: "Fechado hoje" };
  }

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  const current = now.getHours() * 60 + now.getMinutes();
  let open = toMinutes(entry.open);
  let close = toMinutes(entry.close);

  // fecha depois da meia-noite (ex: 18:00–00:30)
  if (close <= open) {
    const openNow = current >= open || current < close;
    return {
      open: openNow,
      label: openNow
        ? `Aberto até ${entry.close}`
        : `Abre às ${entry.open}`,
    };
  }

  const openNow = current >= open && current < close;
  return {
    open: openNow,
    label: openNow ? `Aberto até ${entry.close}` : `Abre às ${entry.open}`,
  };
}

export function loyaltyPointsFor(
  totalSpentEligible: number,
  settings: RestaurantSettings
): number {
  if (settings.loyaltyPointsPerReais <= 0) return 0;
  return Math.floor(totalSpentEligible / settings.loyaltyPointsPerReais);
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  preparando: "Preparando",
  saiu_entrega: "Saiu p/ entrega",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  na_entrega: "Na entrega/retirada",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando PIX",
  awaiting_confirmation: "Cliente disse que pagou",
  paid: "Pago",
  failed: "Falhou",
};
