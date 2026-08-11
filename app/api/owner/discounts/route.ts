import { NextRequest,NextResponse } from "next/server";
import { authorized } from "@/lib/inventory";
import { deleteDiscount,listDiscounts,saveDiscount,toggleDiscount } from "@/lib/orders";
const owner=(request:NextRequest)=>authorized(request.cookies.get("fr_owner")?.value);
export async function GET(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({discounts:await listDiscounts()})}
export async function POST(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});try{const body=await request.json();return NextResponse.json({discounts:await saveDiscount(String(body.code||""),Number(body.percent),body.maxUses?Number(body.maxUses):null)})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not save discount."},{status:400})}}
export async function PATCH(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});const body=await request.json();return NextResponse.json({discounts:await toggleDiscount(String(body.code),Boolean(body.active))})}
export async function DELETE(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});const body=await request.json();return NextResponse.json({discounts:await deleteDiscount(String(body.code))})}
