"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Category, Product } from "../catalog";
import { CartButton } from "../cart";
import { ProductArtwork } from "../product-art";
const key=(category:string,product:string)=>`${category}/${product}`;
type Store={customProducts:(Product&{category:string})[]};
export default function CategoryClient({category}:{category:Category}){
 const [stock,setStock]=useState<Record<string,number>>({});const [store,setStore]=useState<Store>({customProducts:[]});
 useEffect(()=>{fetch("/api/inventory",{cache:"no-store"}).then(r=>r.json()).then(setStock).catch(()=>{});fetch("/api/storefront",{cache:"no-store"}).then(r=>r.json()).then(setStore).catch(()=>{})},[]);
 const products=[...category.products,...store.customProducts.filter(product=>product.category===category.slug)];
 return <main className="shop-page"><nav className="nav"><Link href="/" className="wordmark"><span>FR</span> FOREVERREPENT</Link><div className="navlinks"><Link href="/discord-boost">Discord Boosts</Link><Link href="/music">Music</Link><Link href="/vpn">VPNs</Link><Link href="/streaming">Streaming</Link></div><div className="nav-actions"><Link className="owner-link" href="/owner">Owner login</Link><CartButton/><a className="nav-discord" href="https://discord.gg/uynfPSkK8B" target="_blank">Join the server <b>↗</b></a></div></nav><section className="shop-heading"><Link href="/" className="back">← Back to home</Link><p className="eyebrow">{category.kicker}</p><h1>{category.title}</h1><p>{category.summary}</p></section><section className="shop-products">{products.map(product=>{const count=stock[key(category.slug,product.slug)];return <Link className="listing" href={`/${category.slug}/${product.slug}`} key={product.slug}><ProductArtwork slug={product.slug} name={product.name}/><div><p className="eyebrow">{category.kicker}</p><h2>{product.name}</h2><p>{product.description}</p><small className={count===0?"sold":"available"}>{count===0?"Sold out":count===undefined?"Checking availability…":`${count} in stock`}</small></div><span>View options <b>↗</b></span></Link>})}</section><section className="private-footer"><p>Looking for something not listed?</p><a href="https://discord.com/users/662101534808473600" target="_blank">Contact foreverrepent. for private inquiries ↗</a></section></main>
}
