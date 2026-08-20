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

function mpToken(): string {
  return process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? "";
}

function parseMpErrorBody(text: string): string {
  try {
    const j = JSON.parse(text) as {
      message?: string;
      error?: string;
      cause?: { description?: string; code?: string }[];
    };
    const cause = j.cause?.map((c) => c.description || c.code).filter(Boolean).join("; ");
    return [j.message, j.error, cause].filter(Boolean).join(" — ") || text;
  } catch {
    return text.slice(0, 400);
  }
}

function requireLiveToken(token: string) {
  if (token.startsWith("TEST-")) {
    throw new Error(
      "O token do Mercado Pago é de TESTE. PIX só funciona com Access Token de produção (começa com APP_USR-). Troque na Vercel e faça Redeploy."
    );
  }
}

export async function createMercadoPagoPix(params: {
  amount: number;
  description: string;
  email?: string;
  externalReference: string;
}): Promise<MpPixResult | null> {
  const token = mpToken();
  if (!token) return null;
  requireLiveToken(token);

  const notificationUrl = process.env.MERCADOPAGO_NOTIFICATION_URL?.trim()
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/webhooks/mercadopago`
      : undefined);

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": params.externalReference,
    },
    body: JSON.stringify({
      transaction_amount: Number(params.amount.toFixed(2)),
      description: params.description.slice(0, 255),
      payment_method_id: "pix",
      external_reference: params.externalReference,
      payer: {
        email: params.email || "cliente@pedido.com",
      },
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Mercado Pago: ${parseMpErrorBody(await res.text())}`);
  }

  const data = await res.json();
  const tx = data.point_of_interaction?.transaction_data;
  const copyPaste = String(tx?.qr_code ?? "").trim();
  if (!copyPaste) {
    throw new Error(
      "Mercado Pago não devolveu o QR PIX. Confira se a conta está verificada e com PIX de recebimento ativo no app Mercado Pago."
    );
  }
  return {
    id: String(data.id),
    copyPaste,
    ticketUrl: tx?.ticket_url,
    status: data.status,
  };
}

/** Checkout para crédito/débito (cadastro do cartão e pagamento online). */
export async function createMercadoPagoCheckout(params: {
  amount: number;
  title: string;
  externalReference: string;
}): Promise<{ id: string; initPoint: string } | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return null;

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: params.title,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(params.amount.toFixed(2)),
        },
      ],
      external_reference: params.externalReference,
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
      },
      statement_descriptor: "PEDIDO",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercado Pago checkout: ${err}`);
  }

  const data = await res.json();
  const initPoint = data.init_point || data.sandbox_init_point;
  if (!initPoint) return null;
  return { id: String(data.id), initPoint };
}
