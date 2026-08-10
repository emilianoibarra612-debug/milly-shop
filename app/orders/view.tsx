"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Order = { id: string; subtotal: number; status: string; createdAt: string; items: { name: string }[] };

export default function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem("fr-orders") || "[]"); } catch {}
    const results = await Promise.all(ids.map(async (id) => {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) return null;
      return (await response.json()).order as Order;
    }));
    const visible = results.filter((order): order is Order => Boolean(order));
    localStorage.setItem("fr-orders", JSON.stringify(visible.map(order => order.id)));
    setOrders(visible);
    setLoading(false);
  }, []);

  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, [load]);

  return <main className="order-page"><nav className="nav"><Link href="/" className="wordmark"><span>FR</span> FOREVERREPENT</Link><b className="order-private">PRIVATE ORDERS</b></nav><section className="order-shell orders-history"><header><div><p className="eyebrow">YOUR PRIVATE HISTORY</p><h1>My <em>orders.</em></h1><p>Pending and unfinished orders stay here on this browser so you can return to the owner chat anytime.</p></div><Link className="invoice-print" href="/">Continue shopping</Link></header>{loading?<p>Loading your orders…</p>:orders.length===0?<div className="invoice-card"><h2>No open orders.</h2><p>Your active orders will appear here after checkout.</p></div>:<div className="orders-history-list">{orders.map(order=><Link href={`/order/${order.id}`} key={order.id}><div><small>{new Date(order.createdAt).toLocaleString()}</small><b>{order.id}</b><span>{order.items.map(item=>item.name).join(", ")}</span></div><strong>${order.subtotal.toFixed(2)}</strong><i className={`order-status ${order.status}`}>{order.status}</i><em>Open chat ↗</em></Link>)}</div>}</section></main>;
}
