import { notFound } from "next/navigation";
import { getCategory } from "../../catalog";
import ProductClient from "./view";
export default async function ProductPage({params}:{params:Promise<{category:string,product:string}>}){const {category:categorySlug,product}=await params;const category=getCategory(categorySlug);if(!category)notFound();return <ProductClient category={category} productSlug={product}/>}
