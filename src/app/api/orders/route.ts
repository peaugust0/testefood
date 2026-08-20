import { NextResponse } from "next/server";
import {
  createMercadoPagoPix,
  isMercadoPagoEnabled,
} from "@/lib/mercadopago";
import { buildPixPayload } from "@/lib/pix";
import { readStore, writeStore } from "@/lib/store";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";
import { calcOrderTotals, loyaltyPointsFor, uid } from "@/lib/utils";
import QRCode from "qrcode";

export const runtime = "nodejs";

async function generatePixForOrder(
  storeSettings: Awaited<ReturnType<typeof readStore>>["settings"],
  order: Order
) {
  if (isMercadoPagoEnabled()) {
    try {
      const mp = await createMercadoPagoPix({
        amount: order.total,
        description: `${storeSettings.name} — Pedido #${order.number}`,
        externalReference: order.id,
      });
      if (mp?.copyPaste) {
        const qrDataUrl = await QRCode.toDataURL(mp.copyPaste, {
          margin: 1,
          width: 280,
        });
        return {
          provider: "mercadopago" as const,
          copyPaste: mp.copyPaste,
          qrDataUrl,
          mpPaymentId: mp.id,
          txid: mp.id,
          autoConfirm: true,
        };
      }
    } catch (e) {
      console.error("MP PIX fallback:", e);
    }
  }

  if (!storeSettings.pixKey) {
    throw new Error("Configure a chave PIX no Admin → Config");
  }

  const txid = `PED${String(order.number).slice(-12)}`;
  const copyPaste = buildPixPayload({
    pixKey: storeSettings.pixKey,
    merchantName: storeSettings.pixMerchantName || storeSettings.name,
    merchantCity: storeSettings.pixCity || storeSettings.city,
    amount: order.total,
    txid,
    description: `Pedido ${order.number}`,
  });
  const qrDataUrl = await QRCode.toDataURL(copyPaste, {
    margin: 1,
    width: 280,
  });
  return {
    provider: "static" as const,
    copyPaste,
    qrDataUrl,
    mpPaymentId: undefined as string | undefined,
    txid,
    autoConfirm: false,
  };
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json(store.orders);
}

export async function POST(request: Request) {
  const body = await request.json();
  const store = await readStore();

  const coupon = store.coupons.find(
    (c) =>
      c.active &&
      c.code.toUpperCase() === String(body.couponCode ?? "").toUpperCase()
  );

  const totals = calcOrderTotals({
    items: body.items ?? [],
    fulfillment: body.fulfillment,
    deliveryFee: store.settings.deliveryFee,
    coupon,
  });

  if (
    body.fulfillment === "delivery" &&
    totals.subtotal < store.settings.minOrderDelivery
  ) {
    return NextResponse.json(
      {
        error: `Pedido mínimo para entrega: R$ ${store.settings.minOrderDelivery.toFixed(2)}`,
      },
      { status: 400 }
    );
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: "Carrinho vazio" }, { status: 400 });
  }

  const payment = body.payment ?? "na_entrega";
  const eligibleForLoyalty = totals.subtotal - totals.discount;
  const points = loyaltyPointsFor(eligibleForLoyalty, store.settings);

  const orderNumber = store.orderSeq + 1;
  const order: Order = {
    id: uid("ord"),
    number: orderNumber,
    createdAt: new Date().toISOString(),
    status: "novo",
    fulfillment: body.fulfillment,
    customerName: String(body.customerName ?? "").trim(),
    customerPhone: String(body.customerPhone ?? "").trim(),
    address: body.address,
    tableId: body.tableId,
    items: body.items,
    ...totals,
    couponCode: coupon?.code,
    payment,
    paymentStatus: "pending",
    notes: body.notes,
    loyaltyPointsEarned: points,
  };

  if (!order.customerName || !order.customerPhone) {
    return NextResponse.json(
      { error: "Nome e telefone são obrigatórios" },
      { status: 400 }
    );
  }

  let pix:
    | Awaited<ReturnType<typeof generatePixForOrder>>
    | undefined;

  if (payment === "pix") {
    try {
      pix = await generatePixForOrder(store.settings, order);
      order.pixCopyPaste = pix.copyPaste;
      order.pixTxId = pix.txid;
      order.mpPaymentId = pix.mpPaymentId;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Erro ao gerar PIX" },
        { status: 400 }
      );
    }
  }

  const phoneKey = order.customerPhone.replace(/\D/g, "");
  const existing = store.loyalty.find(
    (l) => l.phone.replace(/\D/g, "") === phoneKey
  );
  if (existing) {
    existing.points += points;
    existing.totalSpent += eligibleForLoyalty;
    existing.name = order.customerName;
  } else {
    store.loyalty.push({
      phone: phoneKey,
      name: order.customerName,
      points,
      totalSpent: eligibleForLoyalty,
    });
  }

  store.orders.unshift(order);
  store.orderSeq = orderNumber;
  await writeStore(store);

  return NextResponse.json({ order, settings: store.settings, pix });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const store = await readStore();

  const isCustomerPixConfirm =
    body.paymentStatus === "awaiting_confirmation" && body.customerConfirm;

  if (!isCustomerPixConfirm) {
    const password = request.headers.get("x-admin-password");
    if (password !== store.settings.adminPassword) {
      return NextResponse.json({ error: "Senha inválida" }, { status: 401 });
    }
  }

  const order = store.orders.find((o) => o.id === body.id);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  if (isCustomerPixConfirm) {
    if (order.payment !== "pix") {
      return NextResponse.json({ error: "Pedido não é PIX" }, { status: 400 });
    }
    order.paymentStatus = "awaiting_confirmation";
  } else {
    if (body.status) order.status = body.status as OrderStatus;
    if (body.paymentStatus) {
      order.paymentStatus = body.paymentStatus as PaymentStatus;
    }
  }

  await writeStore(store);
  return NextResponse.json(order);
}
