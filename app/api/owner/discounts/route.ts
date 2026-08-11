import { NextRequest,NextResponse } from "next/server";
import { authorized } from "@/lib/inventory";
import { deleteDiscount,listDiscounts,saveDiscount,toggleDiscount } from "@/lib/orders";
import {logActivity} from "@/lib/activity";
const owner=(request:NextRequest)=>authorized(request.cookies.get("fr_owner")?.value);
export async function GET(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({discounts:await listDiscounts()})}
export async function POST(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});try{const body=await request.json();const discounts=await saveDiscount(String(body.code||""),Number(body.percent),body.maxUses?Number(body.maxUses):null);await logActivity("Discount saved",`${String(body.code||"").toUpperCase()} · ${Number(body.percent)}% off`);return NextResponse.json({discounts})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not save discount."},{status:400})}}
export async function PATCH(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});const body=await request.json();const discounts=await toggleDiscount(String(body.code),Boolean(body.active));await logActivity("Discount status changed",`${body.code} → ${body.active?"active":"paused"}`);return NextResponse.json({discounts})}
export async function DELETE(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});const body=await request.json();const discounts=await deleteDiscount(String(body.code));await logActivity("Discount deleted",String(body.code));return NextResponse.json({discounts})}
