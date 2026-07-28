import { notFound } from "next/navigation";
import { getCategory,getProduct } from "../../catalog";
import ProductClient from "./view";
export default function ProductPage({params}:{params:{category:string,product:string}}){const category=getCategory(params.category),product=getProduct(params.category,params.product);if(!category||!product)notFound();return <ProductClient category={category} product={product}/>}
