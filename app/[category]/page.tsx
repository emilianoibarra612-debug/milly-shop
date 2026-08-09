import { notFound } from "next/navigation";
import { getCategory } from "../catalog";
import CategoryClient from "./view";
export default function CategoryPage({params}:{params:{category:string}}){const category=getCategory(params.category);if(!category)notFound();return <CategoryClient category={category}/>}
