import { promises as fs } from "fs";
import path from "path";
import { defaultStore } from "./seed";
import { getSupabaseAdmin, isSupabaseEnabled } from "./supabase";
import type { StoreData } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const ROW_ID = "main";

async function readFileStore(): Promise<StoreData> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as StoreData;
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultStore, null, 2), "utf8");
    return structuredClone(defaultStore);
  }
}

async function writeFileStore(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function readStore(): Promise<StoreData> {
  if (isSupabaseEnabled()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb
      .from("app_store")
      .select("data")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) {
      console.error("Supabase read error:", error.message);
      return readFileStore();
    }

    if (!data?.data) {
      await writeStore(defaultStore);
      return structuredClone(defaultStore);
    }

    return data.data as StoreData;
  }

  return readFileStore();
}

export async function writeStore(data: StoreData): Promise<void> {
  if (isSupabaseEnabled()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("app_store").upsert({
      id: ROW_ID,
      data,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Supabase write error:", error.message);
      // fallback local para não perder pedido
      await writeFileStore(data);
      throw new Error(error.message);
    }
    // espelho local opcional
    await writeFileStore(data).catch(() => undefined);
    return;
  }

  await writeFileStore(data);
}

export async function updateStore(
  updater: (current: StoreData) => StoreData
): Promise<StoreData> {
  const current = await readStore();
  const next = updater(current);
  await writeStore(next);
  return next;
}
