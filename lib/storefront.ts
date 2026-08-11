import { promises as fs } from "fs";
import path from "path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Product } from "@/app/catalog";

export type ProductEdit = { name: string; description: string };
export type StorefrontData = { prices: Record<string, number>; productEdits: Record<string, ProductEdit>; customProducts: (Product & { category: string })[] };
type Statement = { bind: (...values: unknown[]) => Statement; run: () => Promise<unknown>; first: <T = Record<string, unknown>>() => Promise<T | null> };
type Database = { prepare: (sql: string) => Statement };
const storePath = path.join(process.cwd(), "data", "storefront.json");
const empty = (): StorefrontData => ({ prices: {}, productEdits: {}, customProducts: [] });
export const priceKey = (category: string, product: string, option: number) => `${category}/${product}/${option}`;

async function cloudflareDb(): Promise<Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as { ORDERS_DB?: Database }).ORDERS_DB || null;
  } catch {
    return null;
  }
}

async function ensureSettings(db: Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
}

export async function readStorefront(): Promise<StorefrontData> {
  const db = await cloudflareDb();
  if (db) {
    await ensureSettings(db);
    const row = await db.prepare("SELECT value FROM settings WHERE key='storefront'").first<{ value: string }>();
    if (!row) return empty();
    try { return { ...empty(), ...JSON.parse(row.value) }; } catch { return empty(); }
  }

  try {
    return { ...empty(), ...JSON.parse(await fs.readFile(storePath, "utf8")) };
  } catch {
    return empty();
  }
}

export async function writeStorefront(value: StorefrontData) {
  const db = await cloudflareDb();
  if (db) {
    await ensureSettings(db);
    await db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('storefront',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(value), new Date().toISOString()).run();
    return;
  }

  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(value, null, 2));
}
