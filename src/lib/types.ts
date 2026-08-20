export type FulfillmentType = "delivery" | "pickup" | "table";

export type OrderStatus =
  | "novo"
  | "preparando"
  | "saiu_entrega"
  | "pronto"
  | "entregue"
  | "cancelado";

export type PaymentMethod = "pix" | "dinheiro" | "cartao" | "na_entrega";

export interface OpeningHours {
  day: number; // 0=domingo
  label: string;
  open: string; // "18:00"
  close: string; // "23:30"
  closed?: boolean;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  active: boolean;
}

export type ProductHighlight = "mais_pedidos" | "promocao";

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  active: boolean;
  featured?: boolean;
  /** Subseção em Destaques */
  highlight?: ProductHighlight;
  extras?: { id: string; name: string; price: number }[];
}

export interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrder: number;
  active: boolean;
  expiresAt?: string;
}

export interface LoyaltyCustomer {
  phone: string;
  name: string;
  points: number;
  totalSpent: number;
}

export interface TableComanda {
  id: string;
  number: string;
  label: string;
  status: "livre" | "ocupada" | "fechando";
  openedAt?: string;
  items: OrderItem[];
  notes?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  extras?: { name: string; price: number }[];
  notes?: string;
}

export type PaymentStatus =
  | "pending"
  | "awaiting_confirmation"
  | "paid"
  | "failed";

export interface Order {
  id: string;
  number: number;
  createdAt: string;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  customerName: string;
  customerPhone: string;
  address?: string;
  tableId?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  couponCode?: string;
  payment: PaymentMethod;
  paymentStatus?: PaymentStatus;
  pixCopyPaste?: string;
  pixTxId?: string;
  mpPaymentId?: string;
  notes?: string;
  loyaltyPointsEarned?: number;
}

export interface RestaurantSettings {
  name: string;
  slogan: string;
  phone: string;
  whatsapp: string; // digits only with country code, e.g. 5511999999999
  address: string;
  city: string;
  minOrderDelivery: number;
  deliveryFee: number;
  deliveryTimeMin: number;
  pickupTimeMin: number;
  loyaltyPointsPerReais: number; // e.g. 10 = 1 ponto a cada R$10
  loyaltyRedeemMin: number;
  pixKey?: string;
  pixMerchantName?: string;
  pixCity?: string;
  adminPassword: string;
  primaryColor: string;
  hours: OpeningHours[];
  bannerEmoji: string;
}

export interface StoreData {
  settings: RestaurantSettings;
  categories: Category[];
  products: Product[];
  coupons: Coupon[];
  loyalty: LoyaltyCustomer[];
  tables: TableComanda[];
  orders: Order[];
  orderSeq: number;
}
