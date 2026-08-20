/**
 * Gera payload PIX (BR Code / EMV) estático com valor.
 * Funciona com qualquer chave PIX — sem gateway e sem mensalidade.
 */

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitizeMerchant(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase() || "RESTAURANTE";
}

export function buildPixPayload(params: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid?: string;
  description?: string;
}): string {
  const key = params.pixKey.trim();
  if (!key) throw new Error("Chave PIX não configurada");

  const amount = Math.max(0, params.amount).toFixed(2);
  const name = sanitizeMerchant(params.merchantName, 25);
  const city = sanitizeMerchant(params.merchantCity.split("-")[0] || "CIDADE", 15);
  const txid = (params.txid ?? `PED${Date.now()}`)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 25);

  const mai =
    tlv("00", "br.gov.bcb.pix") +
    tlv("01", key) +
    (params.description
      ? tlv("02", params.description.slice(0, 50))
      : "");

  const additional = tlv("05", txid);

  const payloadWithoutCrc =
    tlv("00", "01") +
    tlv("26", mai) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount) +
    tlv("58", "BR") +
    tlv("59", name) +
    tlv("60", city) +
    tlv("62", additional) +
    "6304";

  return payloadWithoutCrc + crc16(payloadWithoutCrc);
}

export type PaymentStatus =
  | "pending"
  | "awaiting_confirmation"
  | "paid"
  | "failed";
