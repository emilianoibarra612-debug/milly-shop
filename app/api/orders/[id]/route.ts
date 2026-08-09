import { NextRequest, NextResponse } from "next/server";
import { customerOrder, messagesFor, orderCookie } from "@/lib/orders";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const {id}=await params;const order=await customerOrder(id,request.cookies.get(orderCookie(id))?.value);if(!order)return NextResponse.json({error:"Order not found or access denied."},{status:404});return NextResponse.json({order,messages:await messagesFor(id)})}
