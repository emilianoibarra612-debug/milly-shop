import { notFound } from "next/navigation";
import { getCategory } from "../../catalog";
import ProductClient from "./view";
export default function ProductPage({params}:{params:{category:string,product:string}}){const category=getCategory(params.category);if(!category)notFound();return <ProductClient category={category} productSlug={params.product}/>}
