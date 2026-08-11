import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authorized } from "@/lib/inventory";
import ProductImages from "../images";

export default async function ProductImagesPage(){
 const jar=await cookies();
 if(!authorized(jar.get("fr_owner")?.value))redirect("/owner");
 return <main className="owner-page product-images-page">
  <nav className="nav"><Link href="/" className="wordmark"><span>FR</span> FOREVERREPENT</Link><Link className="nav-discord" href="/owner">Dashboard</Link></nav>
  <section className="owner-content product-images-content"><Link className="owner-back-link" href="/owner">← Back to owner dashboard</Link><ProductImages/></section>
 </main>
}
