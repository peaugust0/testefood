import type { Order, RestaurantSettings } from "./types";
import { formatBRL, itemTotal, PAYMENT_LABEL, STATUS_LABEL } from "./utils";

export function buildWhatsAppOrderMessage(
  order: Order,
  settings: RestaurantSettings
): string {
  const lines: string[] = [];
  lines.push(`*Novo pedido #${order.number}* — ${settings.name}`);
  lines.push("");
  lines.push(`*Cliente:* ${order.customerName}`);
  lines.push(`*Telefone:* ${order.customerPhone}`);
  lines.push(
    `*Tipo:* ${
      order.fulfillment === "delivery"
        ? "Entrega"
        : order.fulfillment === "pickup"
          ? "Retirada"
          : "Mesa"
    }`
  );
  if (order.address) lines.push(`*Endereço:* ${order.address}`);
  if (order.tableId) lines.push(`*Mesa/comanda:* ${order.tableId}`);
  lines.push(`*Pagamento:* ${PAYMENT_LABEL[order.payment] ?? order.payment}`);
  if (order.payment === "dinheiro" && order.cashChangeFor) {
    const change = Math.max(0, order.cashChangeFor - order.total);
    lines.push(
      `*Troco:* para ${formatBRL(order.cashChangeFor)} (troco ${formatBRL(change)})`
    );
  } else if (order.payment === "dinheiro") {
    lines.push("*Troco:* não precisa");
  }
  if (order.payment === "online" && order.onlineCardType) {
    lines.push(
      `*Cartão:* ${order.onlineCardType === "debito" ? "Débito" : "Crédito"}`
    );
  }
  if (
    (order.payment === "pix" || order.payment === "online") &&
    order.paymentStatus
  ) {
    const payLabel: Record<string, string> = {
      pending: "aguardando pagamento na plataforma",
      awaiting_confirmation: "cliente confirmou na plataforma",
      paid: "confirmado",
      failed: "falhou",
    };
    lines.push(
      `*Status pagamento:* ${payLabel[order.paymentStatus] ?? order.paymentStatus}`
    );
  }
  lines.push(`*Status:* ${STATUS_LABEL[order.status] ?? order.status}`);
  lines.push("");
  lines.push("*Itens:*");
  for (const item of order.items) {
    const extras =
      item.extras && item.extras.length
        ? ` (+ ${item.extras.map((e) => e.name).join(", ")})`
        : "";
    lines.push(
      `• ${item.qty}x ${item.name}${extras} — ${formatBRL(itemTotal(item))}`
    );
    if (item.notes) lines.push(`  _Obs: ${item.notes}_`);
  }
  lines.push("");
  lines.push(`Subtotal: ${formatBRL(order.subtotal)}`);
  if (order.deliveryFee > 0) {
    lines.push(`Entrega: ${formatBRL(order.deliveryFee)}`);
  }
  if (order.discount > 0) {
    lines.push(
      `Desconto${order.couponCode ? ` (${order.couponCode})` : ""}: -${formatBRL(order.discount)}`
    );
  }
  lines.push(`*Total: ${formatBRL(order.total)}*`);
  if (order.notes) {
    lines.push("");
    lines.push(`*Obs do pedido:* ${order.notes}`);
  }
  if (order.loyaltyPointsEarned) {
    lines.push("");
    lines.push(`Pontos fidelidade ganhos: +${order.loyaltyPointsEarned}`);
  }
  return lines.join("\n");
}

export function whatsappUrl(phoneDigits: string, message: string): string {
  const phone = phoneDigits.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
