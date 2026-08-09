import { createHmac, scryptSync, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { categories } from "@/app/catalog";
import { readStorefront } from "@/lib/storefront";
const inventoryPath = path.join(process.cwd(), "data", "inventory.json");
const ownerUsername = process.env.OWNER_USERNAME || "millyfn";
const ownerPasswordHash = process.env.OWNER_PASSWORD_HASH || "scrypt:1463ddd51d2e57c78428178681cc8f41:d9d5c5dfd9f846f289a74ddebf7b679980eacba07d228c5b0605d8aadb53de0f8af3f8debecc69385e864e19831c449d294c5e150c3cfa9a81b15495f02359cd";
export type Inventory = Record<string, number>;
export const inventoryKey = (category: string, product: string) => `${category}/${product}`;
async function defaults(): Promise<Inventory> { const store=await readStorefront(); return Object.fromEntries([...categories.flatMap(category=>category.products.map(product=>[inventoryKey(category.slug,product.slug),25])),...store.customProducts.map(product=>[inventoryKey(product.category,product.slug),25])]); }
export async function readInventory(): Promise<Inventory> { const base=await defaults(); try{return {...base,...JSON.parse(await fs.readFile(inventoryPath,"utf8"))}}catch{await writeInventory(base);return base} }
export async function writeInventory(value:Inventory){await fs.mkdir(path.dirname(inventoryPath),{recursive:true});await fs.writeFile(inventoryPath,JSON.stringify(value,null,2))}
const secret=()=>process.env.OWNER_SESSION_SECRET||ownerPasswordHash;
export function makeSession(){return createHmac("sha256",secret()).update("foreverrepent-owner").digest("hex")}
export function authorized(token?:string){const expected=Buffer.from(makeSession());const actual=Buffer.from(token||"");return expected.length===actual.length&&timingSafeEqual(expected,actual)}
function safeEqual(left: string, right: string) {
  const expected = Buffer.from(left);
  const supplied = Buffer.from(right);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function validLogin(username: string, password: string) {
  if (!safeEqual(ownerUsername, username)) return false;

  const [algorithm, saltHex, hashHex] = ownerPasswordHash.split(":");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;

  try {
    const expected = Buffer.from(hashHex, "hex");
    const supplied = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length > 0 && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}
