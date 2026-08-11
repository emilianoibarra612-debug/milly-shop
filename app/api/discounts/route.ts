import { NextRequest,NextResponse } from "next/server";
import { validateDiscount } from "@/lib/orders";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){const {code}=await request.json().catch(()=>({}));const offer=await validateDiscount(String(code||""));return offer?NextResponse.json(offer):NextResponse.json({error:"That discount code is invalid or unavailable."},{status:404})}
