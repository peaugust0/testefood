import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { password } = await request.json();
  const store = await readStore();
  if (password !== store.settings.adminPassword) {
    return NextResponse.json({ ok: false, error: "Senha inválida" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
