import {NextRequest,NextResponse} from "next/server";
import {authorized} from "@/lib/inventory";
import {ownerReviews,setReviewVisibility} from "@/lib/orders";
const owner=(request:NextRequest)=>authorized(request.cookies.get("fr_owner")?.value);
export async function GET(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({reviews:await ownerReviews()})}
export async function PATCH(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});const {id,visible}=await request.json();return NextResponse.json({reviews:await setReviewVisibility(Number(id),Boolean(visible))})}
