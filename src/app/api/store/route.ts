import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import type { StoreData } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const store = await readStore();
  // never expose admin password to public clients
  const { adminPassword: _, ...safeSettings } = store.settings;
  return NextResponse.json({
    ...store,
    settings: { ...safeSettings, adminPassword: "" },
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<StoreData> & {
    adminPassword?: string;
  };

  const current = await readStore();
  const provided = request.headers.get("x-admin-password") ?? body.adminPassword;
  if (provided !== current.settings.adminPassword) {
    return NextResponse.json({ error: "Senha inválida" }, { status: 401 });
  }

  const next: StoreData = {
    ...current,
    ...body,
    settings: {
      ...current.settings,
      ...(body.settings ?? {}),
      // keep password unless explicitly changed to non-empty
      adminPassword:
        body.settings?.adminPassword && body.settings.adminPassword.length > 0
          ? body.settings.adminPassword
          : current.settings.adminPassword,
    },
  };

  await writeStore(next);
  const { adminPassword: _, ...safeSettings } = next.settings;
  return NextResponse.json({
    ...next,
    settings: { ...safeSettings, adminPassword: "" },
  });
}
