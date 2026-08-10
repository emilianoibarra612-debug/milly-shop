import { NextRequest, NextResponse } from "next/server";
import { authorized } from "@/lib/inventory";
import { allOrders, deleteOrder, setOrderStatus } from "@/lib/orders";
export const dynamic="force-dynamic";
const isOwner=(request:NextRequest)=>authorized(request.cookies.get("fr_owner")?.value);
export async function GET(request:NextRequest){if(!isOwner(request))return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({orders:await allOrders()})}
export async function PATCH(request:NextRequest){if(!isOwner(request))return NextResponse.json({error:"Unauthorized"},{status:401});try{const {id,status}=await request.json();await setOrderStatus(String(id),String(status));return NextResponse.json({orders:await allOrders()})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not update order."},{status:400})}}
export async function DELETE(request:NextRequest){if(!isOwner(request))return NextResponse.json({error:"Unauthorized"},{status:401});try{const {id}=await request.json();await deleteOrder(String(id));return NextResponse.json({orders:await allOrders()})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not delete order."},{status:400})}}
