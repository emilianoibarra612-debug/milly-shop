import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createHash, randomBytes } from "crypto";
import { categories } from "@/app/catalog";
import { readStorefront } from "@/lib/storefront";

type Statement={bind:(...values:unknown[])=>Statement;run:()=>Promise<unknown>;first:<T=Record<string,unknown>>()=>Promise<T|null>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type Database={prepare:(sql:string)=>Statement;batch:(statements:Statement[])=>Promise<unknown>};
export type OrderItem={id:string;name:string;option:string;unitPrice:number;quantity:number};
export type Order={id:string;email:string;discordUsername:string;items:OrderItem[];subtotal:number;status:string;createdAt:string;updatedAt:string;discountCode?:string;discount?:number;vouchedAt?:string;warrantyClaimedAt?:string};
export type Message={id:number;orderId:string;sender:"customer"|"owner";body:string;createdAt:string};
export type DiscountCode={code:string;percent:number;active:boolean;uses:number;maxUses:number|null;createdAt:string};
export type PublicReview={product:string;rating:number;review:string;createdAt:string};

export const orderCookie=(id:string)=>`fr_order_${id.replace(/[^a-zA-Z0-9]/g,"")}`;
export const hashToken=(token:string)=>createHash("sha256").update(token).digest("hex");

export async function getDb(){const {env}=await getCloudflareContext({async:true});const db=(env as unknown as {ORDERS_DB?:Database}).ORDERS_DB;if(!db)throw new Error("ORDERS_DB binding is unavailable");await ensureSchema(db);return db}
async function ensureSchema(db:Database){await db.batch([
 db.prepare("CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, access_hash TEXT NOT NULL UNIQUE, email TEXT NOT NULL, items_json TEXT NOT NULL, subtotal_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
 db.prepare("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, sender TEXT NOT NULL CHECK(sender IN ('customer','owner')), body TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE)"),
 db.prepare("CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id,id)"),
 db.prepare("CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)")
 ,db.prepare("CREATE TABLE IF NOT EXISTS order_events (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('vouch','warranty')), body TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE)"),
 db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_order_event_once ON order_events(order_id,type)")
 ,db.prepare("CREATE TABLE IF NOT EXISTS discount_codes (code TEXT PRIMARY KEY, percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 100), active INTEGER NOT NULL DEFAULT 1, uses INTEGER NOT NULL DEFAULT 0, max_uses INTEGER, created_at TEXT NOT NULL)"),
 db.prepare("CREATE TABLE IF NOT EXISTS login_attempts (ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, blocked_until TEXT, updated_at TEXT NOT NULL)")
]);const {results:columns}=await db.prepare("PRAGMA table_info(orders)").all<{name:string}>();if(!columns.some(column=>column.name==="discord_username"))await db.prepare("ALTER TABLE orders ADD COLUMN discord_username TEXT NOT NULL DEFAULT ''").run();if(!columns.some(column=>column.name==="discount_code"))await db.prepare("ALTER TABLE orders ADD COLUMN discount_code TEXT NOT NULL DEFAULT ''").run();if(!columns.some(column=>column.name==="discount_cents"))await db.prepare("ALTER TABLE orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0").run();const {results:eventColumns}=await db.prepare("PRAGMA table_info(order_events)").all<{name:string}>();if(!eventColumns.some(column=>column.name==="visible"))await db.prepare("ALTER TABLE order_events ADD COLUMN visible INTEGER NOT NULL DEFAULT 1").run()}

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

export async function validateDiscount(raw:string){const code=raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,24);if(!code)return null;const db=await getDb();const row=await db.prepare("SELECT * FROM discount_codes WHERE code=? AND active=1").bind(code).first<Record<string,unknown>>();if(!row||(row.max_uses!==null&&Number(row.uses)>=Number(row.max_uses)))return null;return{code,percent:Number(row.percent)}}
export async function createOrder(email:string,discordUsername:string,items:OrderItem[],rawDiscount=""){const db=await getDb();const now=new Date().toISOString();const id=`FR-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;const token=randomBytes(32).toString("hex");const beforeDiscount=Math.round(items.reduce((sum,item)=>sum+item.unitPrice*item.quantity,0)*100)/100;const offer=await validateDiscount(rawDiscount);const discount=offer?Math.round(beforeDiscount*offer.percent)/100:0;const subtotal=Math.max(0,Math.round((beforeDiscount-discount)*100)/100);await db.prepare("INSERT INTO orders (id,access_hash,email,discord_username,items_json,subtotal_cents,status,created_at,updated_at,discount_code,discount_cents) VALUES (?,?,?,?,?,?,'pending',?,?,?,?)").bind(id,hashToken(token),email.toLowerCase(),discordUsername,JSON.stringify(items),Math.round(subtotal*100),now,now,offer?.code||"",Math.round(discount*100)).run();if(offer)await db.prepare("UPDATE discount_codes SET uses=uses+1 WHERE code=?").bind(offer.code).run();return{order:{id,email:email.toLowerCase(),discordUsername,items,subtotal,status:"pending",createdAt:now,updatedAt:now,discountCode:offer?.code,discount} satisfies Order,token}}
const mapOrder=(row:Record<string,unknown>):Order=>({id:String(row.id),email:String(row.email),discordUsername:String(row.discord_username||""),items:JSON.parse(String(row.items_json)),subtotal:Number(row.subtotal_cents)/100,status:String(row.status),createdAt:String(row.created_at),updatedAt:String(row.updated_at),discountCode:String(row.discount_code||"")||undefined,discount:Number(row.discount_cents||0)/100});
export async function customerOrder(id:string,token?:string){if(!token)return null;const db=await getDb();const row=await db.prepare("SELECT * FROM orders WHERE id=? AND access_hash=? AND status!='closed'").bind(id,hashToken(token)).first();return row?mapOrder(row):null}
export async function orderEvents(id:string){const db=await getDb();const {results}=await db.prepare("SELECT type,created_at FROM order_events WHERE order_id=?").bind(id).all<Record<string,unknown>>();return Object.fromEntries(results.map(row=>[String(row.type),String(row.created_at)])) as Record<string,string>}
export async function customerOrderWithEvents(id:string,token?:string){const order=await customerOrder(id,token);if(!order)return null;const events=await orderEvents(id);return{...order,vouchedAt:events.vouch,warrantyClaimedAt:events.warranty}}
export async function messagesFor(id:string){const db=await getDb();const {results}=await db.prepare("SELECT id,order_id,sender,body,created_at FROM messages WHERE order_id=? ORDER BY id").bind(id).all<Record<string,unknown>>();return results.map(row=>({id:Number(row.id),orderId:String(row.order_id),sender:String(row.sender) as "customer"|"owner",body:String(row.body),createdAt:String(row.created_at)}))}
export async function addMessage(id:string,sender:"customer"|"owner",body:string){const clean=body.trim().slice(0,2000);if(!clean)throw new Error("Message cannot be empty.");const db=await getDb();await db.prepare("INSERT INTO messages (order_id,sender,body,created_at) VALUES (?,?,?,?)").bind(id,sender,clean,new Date().toISOString()).run()}
export async function allOrders() {
  const db = await getDb();
  const { results } = await db
    .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 250")
    .all<Record<string, unknown>>();
  const {results:eventRows}=await db.prepare("SELECT order_id,type,created_at FROM order_events").all<Record<string,unknown>>();
  const eventsByOrder=new Map<string,Record<string,string>>();for(const event of eventRows){const id=String(event.order_id);eventsByOrder.set(id,{...(eventsByOrder.get(id)||{}),[String(event.type)]:String(event.created_at)})}
  return Promise.all(
    results.map(async (row) => {const id=String(row.id);const events=eventsByOrder.get(id)||{};return{
      ...mapOrder(row),vouchedAt:events.vouch,warrantyClaimedAt:events.warranty,
      messages: await messagesFor(id),
    }}),
  );
}
export async function addVouch(id:string,rating:number,review:string){const clean=review.trim().slice(0,500);if(!Number.isInteger(rating)||rating<1||rating>5)throw new Error("Choose a rating from 1 to 5.");if(clean.length<5)throw new Error("Write at least 5 characters for your vouch.");const db=await getDb();const order=await db.prepare("SELECT status FROM orders WHERE id=?").bind(id).first<{status:string}>();if(order?.status!=="completed")throw new Error("Complete the order before vouching.");await db.prepare("INSERT OR IGNORE INTO order_events (order_id,type,body,created_at) VALUES (?,'vouch',?,?)").bind(id,JSON.stringify({rating,review:clean}),new Date().toISOString()).run()}
export async function addWarrantyClaim(id:string,body:string){const clean=body.trim().slice(0,1000);if(clean.length<10)throw new Error("Describe the issue in at least 10 characters.");const db=await getDb();const order=await db.prepare("SELECT status,updated_at FROM orders WHERE id=?").bind(id).first<{status:string;updated_at:string}>();if(order?.status!=="completed")throw new Error("Only completed orders can open warranty claims.");const events=await orderEvents(id);if(!events.vouch)throw new Error("A vouch is required for warranty coverage.");if(Date.now()-new Date(order.updated_at).getTime()>30*24*60*60*1000)throw new Error("The one-month warranty period has ended.");await db.prepare("INSERT INTO order_events (order_id,type,body,created_at) VALUES (?,'warranty',?,?)").bind(id,clean,new Date().toISOString()).run();await addMessage(id,"customer",`WARRANTY CLAIM: ${clean}`)}
export async function recentSales(){
 const db=await getDb();
 const {results}=await db.prepare("SELECT items_json,updated_at FROM orders WHERE status='completed' ORDER BY updated_at DESC LIMIT 6").all<Record<string,unknown>>();
 return results.map(row=>({product:(JSON.parse(String(row.items_json)) as OrderItem[])[0]?.name||"Digital product",completedAt:String(row.updated_at)}));
}
export async function publicReviews(){const db=await getDb();const {results}=await db.prepare("SELECT o.items_json,e.body,e.created_at FROM order_events e JOIN orders o ON o.id=e.order_id WHERE e.type='vouch' AND e.body!='' AND e.visible=1 ORDER BY e.created_at DESC LIMIT 12").all<Record<string,unknown>>();return results.flatMap(row=>{try{const body=JSON.parse(String(row.body)) as {rating?:number;review?:string};const product=(JSON.parse(String(row.items_json)) as OrderItem[])[0]?.name||"Digital product";return Number.isInteger(body.rating)&&body.review?[{product,rating:Number(body.rating),review:String(body.review),createdAt:String(row.created_at)} satisfies PublicReview]:[]}catch{return[]}})}
export async function ownerReviews(){const db=await getDb();const {results}=await db.prepare("SELECT e.id,e.order_id,o.items_json,e.body,e.created_at,e.visible FROM order_events e JOIN orders o ON o.id=e.order_id WHERE e.type='vouch' AND e.body!='' ORDER BY e.created_at DESC").all<Record<string,unknown>>();return results.flatMap(row=>{try{const body=JSON.parse(String(row.body)) as {rating?:number;review?:string};return[{id:Number(row.id),orderId:String(row.order_id),product:(JSON.parse(String(row.items_json)) as OrderItem[])[0]?.name||"Digital product",rating:Number(body.rating),review:String(body.review),createdAt:String(row.created_at),visible:Boolean(row.visible)}]}catch{return[]}})}
export async function setReviewVisibility(id:number,visible:boolean){const db=await getDb();await db.prepare("UPDATE order_events SET visible=? WHERE id=? AND type='vouch'").bind(visible?1:0,id).run();return ownerReviews()}
export async function listDiscounts(){const db=await getDb();const {results}=await db.prepare("SELECT * FROM discount_codes ORDER BY created_at DESC").all<Record<string,unknown>>();return results.map(row=>({code:String(row.code),percent:Number(row.percent),active:Boolean(row.active),uses:Number(row.uses),maxUses:row.max_uses===null?null:Number(row.max_uses),createdAt:String(row.created_at)} satisfies DiscountCode))}
export async function saveDiscount(codeRaw:string,percent:number,maxUses:number|null,active=true){const code=codeRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,24);if(code.length<2)throw new Error("Use at least 2 letters or numbers.");if(!Number.isInteger(percent)||percent<1||percent>100)throw new Error("Discount must be from 1% to 100%.");if(maxUses!==null&&(!Number.isInteger(maxUses)||maxUses<1))throw new Error("Usage limit must be a positive whole number.");const db=await getDb();await db.prepare("INSERT INTO discount_codes (code,percent,active,uses,max_uses,created_at) VALUES (?,?,?,0,?,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,active=excluded.active,max_uses=excluded.max_uses").bind(code,percent,active?1:0,maxUses,new Date().toISOString()).run();return listDiscounts()}
export async function toggleDiscount(code:string,active:boolean){const db=await getDb();await db.prepare("UPDATE discount_codes SET active=? WHERE code=?").bind(active?1:0,code).run();return listDiscounts()}
export async function deleteDiscount(code:string){const db=await getDb();await db.prepare("DELETE FROM discount_codes WHERE code=?").bind(code).run();return listDiscounts()}
export async function loginAllowed(ip:string){const db=await getDb();const key=hashToken(ip);const row=await db.prepare("SELECT attempts,blocked_until FROM login_attempts WHERE ip_hash=?").bind(key).first<{attempts:number;blocked_until:string|null}>();return!row?.blocked_until||Date.parse(row.blocked_until)<=Date.now()}
export async function recordLogin(ip:string,success:boolean){const db=await getDb();const key=hashToken(ip);if(success){await db.prepare("DELETE FROM login_attempts WHERE ip_hash=?").bind(key).run();return}const row=await db.prepare("SELECT attempts FROM login_attempts WHERE ip_hash=?").bind(key).first<{attempts:number}>();const attempts=(row?.attempts||0)+1;const blocked=attempts>=5?new Date(Date.now()+15*60*1000).toISOString():null;await db.prepare("INSERT INTO login_attempts (ip_hash,attempts,blocked_until,updated_at) VALUES (?,?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts=excluded.attempts,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at").bind(key,attempts,blocked,new Date().toISOString()).run()}
export async function databaseBackup(){const db=await getDb();const tables=["orders","messages","order_events","discount_codes","settings"];const data:Record<string,unknown[]>={};for(const table of tables){try{data[table]=(await db.prepare(`SELECT * FROM ${table}`).all<Record<string,unknown>>()).results}catch{data[table]=[]}}return{version:1,exportedAt:new Date().toISOString(),data}}
export async function setOrderStatus(id:string,status:string){if(!["pending","paid","completed","cancelled","closed"].includes(status))throw new Error("Invalid order status.");const db=await getDb();await db.prepare("UPDATE orders SET status=?,updated_at=? WHERE id=?").bind(status,new Date().toISOString(),id).run()}
export async function deleteOrder(id:string){const db=await getDb();await db.batch([db.prepare("DELETE FROM order_events WHERE order_id=?").bind(id),db.prepare("DELETE FROM messages WHERE order_id=?").bind(id),db.prepare("DELETE FROM orders WHERE id=?").bind(id)])}
