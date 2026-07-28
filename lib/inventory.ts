import { createHmac, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { categories } from "@/app/catalog";

const inventoryPath = path.join(process.cwd(), "data", "inventory.json");
export type Inventory = Record<string, number>;
export const inventoryKey = (category: string, product: string) => `${category}/${product}`;

function defaults(): Inventory {
  return Object.fromEntries(categories.flatMap(category => category.products.map(product => [inventoryKey(category.slug, product.slug), 25])));
}
export async function readInventory(): Promise<Inventory> {
  try { return { ...defaults(), ...JSON.parse(await fs.readFile(inventoryPath, "utf8")) }; }
  catch { const value = defaults(); await writeInventory(value); return value; }
}
export async function writeInventory(value: Inventory) { await fs.mkdir(path.dirname(inventoryPath), { recursive: true }); await fs.writeFile(inventoryPath, JSON.stringify(value, null, 2)); }
const secret = () => process.env.OWNER_SESSION_SECRET || "development-only-change-me";
export function makeSession() { return createHmac("sha256", secret()).update("foreverrepent-owner").digest("hex"); }
export function authorized(token?: string) { const expected = Buffer.from(makeSession()); const actual = Buffer.from(token || ""); return expected.length === actual.length && timingSafeEqual(expected, actual); }
export function validLogin(username: string, password: string) {
  const user = Buffer.from(process.env.OWNER_USERNAME || ""); const suppliedUser = Buffer.from(username);
  const pass = Buffer.from(process.env.OWNER_PASSWORD || ""); const suppliedPass = Buffer.from(password);
  return user.length === suppliedUser.length && pass.length === suppliedPass.length && timingSafeEqual(user, suppliedUser) && timingSafeEqual(pass, suppliedPass);
}
