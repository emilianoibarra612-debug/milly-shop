import type { Order } from "@/lib/orders";

const webhookPattern=/^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/;

export async function sendOrderAlert(order:Order){
 const webhook=process.env.DISCORD_WEBHOOK_URL?.trim();
 if(!webhook||!webhookPattern.test(webhook))return false;
 const products=order.items.map(item=>`• ${item.name} — ${item.option} ×${item.quantity}`).join("\n").slice(0,1024);
 const response=await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
  username:"ForeverRepent Orders",
  allowed_mentions:{parse:[]},
  embeds:[{title:"🛒 New website order",color:0xd99a6d,fields:[
   {name:"Order ID",value:`\`${order.id}\``,inline:true},
   {name:"Total",value:`$${order.subtotal.toFixed(2)}`,inline:true},
   {name:"Status",value:"Pending payment",inline:true},
   {name:"Products",value:products||"Digital product"}
  ],footer:{text:"Open the ForeverRepent owner panel for customer details."},timestamp:order.createdAt}]
 })});
 return response.ok;
}
