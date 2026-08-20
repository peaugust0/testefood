import { NextResponse } from "next/server";
import { isMercadoPagoEnabled } from "@/lib/mercadopago";

export const runtime = "nodejs";

/** Não revela o token — só se a Vercel enxerga a variável. */
export async function GET() {
  return NextResponse.json({
    mercadoPagoConfigured: isMercadoPagoEnabled(),
    vercelEnv: process.env.VERCEL_ENV ?? "local",
  });
}
