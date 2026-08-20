/**
 * Mercado Pago — preparado para ativar depois.
 * Com MERCADOPAGO_ACCESS_TOKEN no .env, o /api/pix passa a criar
 * cobrança PIX com confirmação automática via webhook.
 */

export type MpPixResult = {
  id: string;
  copyPaste: string;
  ticketUrl?: string;
  status: string;
};

export function isMercadoPagoEnabled(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

export async function createMercadoPagoPix(params: {
  amount: number;
  description: string;
  email?: string;
  externalReference: string;
}): Promise<MpPixResult | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return null;

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": params.externalReference,
    },
    body: JSON.stringify({
      transaction_amount: Number(params.amount.toFixed(2)),
      description: params.description,
      payment_method_id: "pix",
      external_reference: params.externalReference,
      payer: {
        email: params.email || "cliente@email.com",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercado Pago: ${err}`);
  }

  const data = await res.json();
  const tx = data.point_of_interaction?.transaction_data;
  return {
    id: String(data.id),
    copyPaste: tx?.qr_code ?? "",
    ticketUrl: tx?.ticket_url,
    status: data.status,
  };
}
