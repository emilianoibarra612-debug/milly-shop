import { promises as fs } from "fs";
import path from "path";
import { Product } from "@/app/catalog";

export type StorefrontData = { prices: Record<string, number>; customProducts: (Product & { category: string })[] };
const storePath = path.join(process.cwd(), "data", "storefront.json");
const empty = (): StorefrontData => ({ prices: {}, customProducts: [] });
export const priceKey = (category: string, product: string, option: number) => `${category}/${product}/${option}`;
export async function readStorefront(): Promise<StorefrontData> { try { const parsed = JSON.parse(await fs.readFile(storePath, "utf8")); return { ...empty(), ...parsed }; } catch { const value = empty(); await writeStorefront(value); return value; } }
export async function writeStorefront(value: StorefrontData) { await fs.mkdir(path.dirname(storePath), { recursive: true }); await fs.writeFile(storePath, JSON.stringify(value, null, 2)); }
