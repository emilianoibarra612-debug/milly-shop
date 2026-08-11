import { createHmac, scryptSync, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { categories } from "@/app/catalog";
import { readStorefront } from "@/lib/storefront";
const inventoryPath = path.join(process.cwd(), "data", "inventory.json");
const ownerUsername = process.env.OWNER_USERNAME || "millyfn";
const ownerPasswordHash = process.env.OWNER_PASSWORD_HASH || "scrypt:1463ddd51d2e57c78428178681cc8f41:d9d5c5dfd9f846f289a74ddebf7b679980eacba07d228c5b0605d8aadb53de0f8af3f8debecc69385e864e19831c449d294c5e150c3cfa9a81b15495f02359cd";
export type Inventory = Record<string, number>;
type Statement = { bind: (...values: unknown[]) => Statement; run: () => Promise<unknown>; first: <T = Record<string, unknown>>() => Promise<T | null> };
type Database = { prepare: (sql: string) => Statement };
export const inventoryKey = (category: string, product: string) => `${category}/${product}`;
async function defaults(): Promise<Inventory> { const store=await readStorefront(); return Object.fromEntries([...categories.flatMap(category=>category.products.map(product=>[inventoryKey(category.slug,product.slug),25])),...store.customProducts.map(product=>[inventoryKey(product.category,product.slug),25])]); }
async function cloudflareDb():Promise<Database|null>{try{const {env}=await getCloudflareContext({async:true});return (env as unknown as {ORDERS_DB?:Database}).ORDERS_DB||null}catch{return null}}
async function ensureSettings(db:Database){await db.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)").run()}
export async function readInventory(): Promise<Inventory> { const base=await defaults();const db=await cloudflareDb();if(db){await ensureSettings(db);const row=await db.prepare("SELECT value FROM settings WHERE key='inventory'").first<{value:string}>();if(!row)return base;try{return {...base,...JSON.parse(row.value)}}catch{return base}}try{return {...base,...JSON.parse(await fs.readFile(inventoryPath,"utf8"))}}catch{return base} }
export async function writeInventory(value:Inventory){const db=await cloudflareDb();if(db){await ensureSettings(db);await db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('inventory',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(value),new Date().toISOString()).run();return}await fs.mkdir(path.dirname(inventoryPath),{recursive:true});await fs.writeFile(inventoryPath,JSON.stringify(value,null,2))}
const secret=()=>process.env.OWNER_SESSION_SECRET||ownerPasswordHash;
export function makeSession(){const issued=Math.floor(Date.now()/1000).toString(36);const signature=createHmac("sha256",secret()).update(`foreverrepent-owner:${issued}`).digest("hex");return`${issued}.${signature}`}
export function authorized(token?:string){const [issued,signature]=String(token||"").split(".");const timestamp=parseInt(issued,36);if(!issued||!signature||!Number.isFinite(timestamp)||Date.now()/1000-timestamp>60*60*2)return false;const expected=Buffer.from(createHmac("sha256",secret()).update(`foreverrepent-owner:${issued}`).digest("hex"));const actual=Buffer.from(signature);return expected.length===actual.length&&timingSafeEqual(expected,actual)}
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
export const twoFactorEnabled=()=>Boolean(process.env.OWNER_TOTP_SECRET);
function decodeBase32(value:string){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";for(const char of value.toUpperCase().replace(/[^A-Z2-7]/g,"")){const index=alphabet.indexOf(char);if(index<0)continue;bits+=index.toString(2).padStart(5,"0")}const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(bytes)}
export function validTotp(code:string){const secret=process.env.OWNER_TOTP_SECRET;if(!secret)return true;if(!/^\d{6}$/.test(code))return false;const key=decodeBase32(secret);const now=Math.floor(Date.now()/30000);for(let offset=-1;offset<=1;offset++){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(now+offset));const digest=createHmac("sha1",key).update(counter).digest();const start=digest[digest.length-1]&15;const value=((digest.readUInt32BE(start)&0x7fffffff)%1000000).toString().padStart(6,"0");if(safeEqual(value,code))return true}return false}
