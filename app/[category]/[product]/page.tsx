import { notFound } from "next/navigation";
import { getCategory, getProduct } from "../../catalog";
import ProductClient from "./view";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ category: string; product: string }>;
}) {
  const { category: categorySlug, product: productSlug } = await params;
  const category = getCategory(categorySlug);
  const product = getProduct(categorySlug, productSlug);
  if (!category || !product) notFound();
  return <ProductClient category={category} product={product} />;
}