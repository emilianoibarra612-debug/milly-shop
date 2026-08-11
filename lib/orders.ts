import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createHash, randomBytes } from "crypto";
import { categories } from "@/app/catalog";
import { readStorefront } from "@/lib/storefront";
import { readInventory } from "@/lib/inventory";

type Statement={bind:(...values:unknown[])=>Statement;run:()=>Promise<unknown>;first:<T=Record<string,unknown>>()=>Promise<T|null>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type Database={prepare:(sql:string)=>Statement;batch:(statements:Statement[])=>Promise<unknown>};
export type OrderItem={id:string;name:string;option:string;unitPrice:number;quantity:number};
export type Order={id:string;email:string;discordUsername:string;items:OrderItem[];subtotal:number;status:string;createdAt:string;updatedAt:string};
export type Message={id:number;orderId:string;sender:"customer"|"owner";body:string;createdAt:string};

export const orderCookie=(id:string)=>`fr_order_${id.replace(/[^a-zA-Z0-9]/g,"")}`;
export const hashToken=(token:string)=>createHash("sha256").update(token).digest("hex");

export async function getDb(){const {env}=await getCloudflareContext({async:true});const db=(env as unknown as {ORDERS_DB?:Database}).ORDERS_DB;if(!db)throw new Error("ORDERS_DB binding is unavailable");await ensureSchema(db);return db}
async function ensureSchema(db:Database){await db.batch([
 db.prepare("CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, access_hash TEXT NOT NULL UNIQUE, email TEXT NOT NULL, items_json TEXT NOT NULL, subtotal_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
 db.prepare("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, sender TEXT NOT NULL CHECK(sender IN ('customer','owner')), body TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE)"),
 db.prepare("CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id,id)"),
 db.prepare("CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)")
]);const {results:columns}=await db.prepare("PRAGMA table_info(orders)").all<{name:string}>();if(!columns.some(column=>column.name==="discord_username"))await db.prepare("ALTER TABLE orders ADD COLUMN discord_username TEXT NOT NULL DEFAULT ''").run();if(!columns.some(column=>column.name==="stock_deducted"))await db.prepare("ALTER TABLE orders ADD COLUMN stock_deducted INTEGER NOT NULL DEFAULT 0").run()}

export async function priceItems(input: unknown): Promise<OrderItem[]> {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
    throw new Error("Your bag is empty or too large.");
  }

  const store = await readStorefront();
  const all = categories.flatMap((category) =>
    [
      ...category.products,
      ...store.customProducts.filter((product) => product.category === category.slug),
    ].map((product) => ({ category: category.slug, product })),
  );

  return input.map((raw: unknown) => {
    const item = raw as { id?: unknown; option?: unknown; quantity?: unknown };
    const quantity = Number(item.quantity);
    if (
      typeof item.id !== "string" ||
      typeof item.option !== "string" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 25
    ) {
      throw new Error("Invalid cart item.");
    }

    const [categorySlug, productSlug] = item.id.split("/");
    const found = all.find(
      (entry) => entry.category === categorySlug && entry.product.slug === productSlug,
    );
    if (!found) throw new Error("A product in your bag is unavailable.");

    const optionIndex = found.product.options.findIndex(
      (option) => option.label === item.option,
    );
    if (optionIndex < 0) throw new Error("A product option is unavailable.");

    const base = found.product.options[optionIndex];
    const unitPrice =
      store.prices[`${categorySlug}/${productSlug}/${optionIndex}`] ?? base.price;

    return {
      id: `${categorySlug}/${productSlug}`,
      name: found.product.name,
      option: base.label,
      unitPrice,
      quantity,
    };
  });
}

export async function createOrder(email:string,discordUsername:string,items:OrderItem[]){const db=await getDb();const now=new Date().toISOString();const id=`FR-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;const token=randomBytes(32).toString("hex");const subtotal=Math.round(items.reduce((sum,item)=>sum+item.unitPrice*item.quantity,0)*100)/100;await db.prepare("INSERT INTO orders (id,access_hash,email,discord_username,items_json,subtotal_cents,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?)").bind(id,hashToken(token),email.toLowerCase(),discordUsername,JSON.stringify(items),Math.round(subtotal*100),now,now).run();return{order:{id,email:email.toLowerCase(),discordUsername,items,subtotal,status:"pending",createdAt:now,updatedAt:now} satisfies Order,token}}
const mapOrder=(row:Record<string,unknown>):Order=>({id:String(row.id),email:String(row.email),discordUsername:String(row.discord_username||""),items:JSON.parse(String(row.items_json)),subtotal:Number(row.subtotal_cents)/100,status:String(row.status),createdAt:String(row.created_at),updatedAt:String(row.updated_at)});
export async function customerOrder(id:string,token?:string){if(!token)return null;const db=await getDb();const row=await db.prepare("SELECT * FROM orders WHERE id=? AND access_hash=? AND status!='closed'").bind(id,hashToken(token)).first();return row?mapOrder(row):null}
export async function messagesFor(id:string){const db=await getDb();const {results}=await db.prepare("SELECT id,order_id,sender,body,created_at FROM messages WHERE order_id=? ORDER BY id").bind(id).all<Record<string,unknown>>();return results.map(row=>({id:Number(row.id),orderId:String(row.order_id),sender:String(row.sender) as "customer"|"owner",body:String(row.body),createdAt:String(row.created_at)}))}
export async function addMessage(id:string,sender:"customer"|"owner",body:string){const clean=body.trim().slice(0,2000);if(!clean)throw new Error("Message cannot be empty.");const db=await getDb();await db.prepare("INSERT INTO messages (order_id,sender,body,created_at) VALUES (?,?,?,?)").bind(id,sender,clean,new Date().toISOString()).run()}
export async function allOrders() {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 250")
    .all<Record<string, unknown>>();
  return Promise.all(
    results.map(async (row) => ({
      ...mapOrder(row),
      messages: await messagesFor(String(row.id)),
    })),
  );
}
export async function setOrderStatus(id:string,status:string){
 if(!["pending","paid","completed","cancelled","closed"].includes(status))throw new Error("Invalid order status.");
 const db=await getDb();const row=await db.prepare("SELECT items_json,stock_deducted FROM orders WHERE id=?").bind(id).first<{items_json:string;stock_deducted:number}>();if(!row)throw new Error("Order not found.");const now=new Date().toISOString();
 if(status==="completed"&&!Number(row.stock_deducted)){
  const inventory=await readInventory();const items=JSON.parse(row.items_json) as OrderItem[];
  for(const item of items)if(item.id in inventory)inventory[item.id]=Math.max(0,inventory[item.id]-item.quantity);
  await db.batch([db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('inventory',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(inventory),now),db.prepare("UPDATE orders SET status='completed',stock_deducted=1,updated_at=? WHERE id=? AND stock_deducted=0").bind(now,id)]);return;
 }
 await db.prepare("UPDATE orders SET status=?,updated_at=? WHERE id=?").bind(status,now,id).run()
}
export async function deleteOrder(id:string){const db=await getDb();await db.batch([db.prepare("DELETE FROM messages WHERE order_id=?").bind(id),db.prepare("DELETE FROM orders WHERE id=?").bind(id)])}
