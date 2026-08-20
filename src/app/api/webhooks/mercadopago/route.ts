import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Webhook Mercado Pago — quando o PIX for pago, marca o pedido.
 * Configure a URL: https://SEU-DOMINIO/api/webhooks/mercadopago
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const paymentId =
    body?.data?.id || body?.id || request.headers.get("x-payment-id");

  if (!paymentId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ ok: true, skipped: "no_token" });
  }

  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    return NextResponse.json({ error: "payment_fetch_failed" }, { status: 502 });
  }

  const payment = await res.json();
  if (payment.status !== "approved") {
    return NextResponse.json({ ok: true, status: payment.status });
  }

  const store = await readStore();
  const order = store.orders.find(
    (o: Order) =>
      o.mpPaymentId === String(payment.id) ||
      o.id === payment.external_reference ||
      String(o.number) === String(payment.external_reference)
  );

  if (order) {
    order.paymentStatus = "paid";
    if (order.status === "novo") order.status = "preparando";
    await writeStore(store);
  }

  return NextResponse.json({ ok: true, paid: Boolean(order) });
}
