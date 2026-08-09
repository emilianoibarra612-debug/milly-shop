import { notFound } from "next/navigation";
import { getCategory } from "../catalog";
import CategoryClient from "./view";
export default async function CategoryPage({params}:{params:Promise<{category:string}>}){const {category:categorySlug}=await params;const category=getCategory(categorySlug);if(!category)notFound();return <CategoryClient category={category}/>}
