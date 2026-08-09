import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/inventory";
import { addMessage, allOrders } from "@/lib/orders";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){if(!authorized(request.cookies.get("fr_owner")?.value))return NextResponse.json({error:"Unauthorized"},{status:401});try{const {id}=await params;const {body}=await request.json();await addMessage(id,"owner",String(body||""));return NextResponse.json({orders:await allOrders()})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not send message."},{status:400})}}
