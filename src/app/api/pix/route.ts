import { NextResponse } from "next/server";
import {
  createMercadoPagoPix,
  isMercadoPagoEnabled,
} from "@/lib/mercadopago";
import { buildPixPayload } from "@/lib/pix";
import { readStore } from "@/lib/store";
import QRCode from "qrcode";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const amount = Number(body.amount);
  const orderNumber = body.orderNumber;
  const orderId = String(body.orderId ?? "");

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  const store = await readStore();
  const s = store.settings;

  if (isMercadoPagoEnabled()) {
    try {
      const mp = await createMercadoPagoPix({
        amount,
        description: `${s.name} — Pedido #${orderNumber}`,
        email: body.email,
        externalReference: orderId || `ord_${orderNumber}`,
      });
      if (mp?.copyPaste) {
        const qrDataUrl = await QRCode.toDataURL(mp.copyPaste, {
          margin: 1,
          width: 280,
          color: { dark: "#000000", light: "#ffffff" },
        });
        return NextResponse.json({
          provider: "mercadopago",
          copyPaste: mp.copyPaste,
          qrDataUrl,
          mpPaymentId: mp.id,
          txid: mp.id,
          autoConfirm: true,
        });
      }
    } catch (e) {
      console.error(e);
      // cai no PIX estático
    }
  }

  if (!s.pixKey) {
    return NextResponse.json(
      { error: "Configure a chave PIX no admin (Config)" },
      { status: 400 }
    );
  }

  const txid = `PED${String(orderNumber ?? Date.now()).replace(/\D/g, "").slice(-12)}`;
  const copyPaste = buildPixPayload({
    pixKey: s.pixKey,
    merchantName: s.pixMerchantName || s.name,
    merchantCity: s.pixCity || s.city,
    amount,
    txid,
    description: `Pedido ${orderNumber}`,
  });

  const qrDataUrl = await QRCode.toDataURL(copyPaste, {
    margin: 1,
    width: 280,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return NextResponse.json({
    provider: "static",
    copyPaste,
    qrDataUrl,
    txid,
    autoConfirm: false,
  });
}
