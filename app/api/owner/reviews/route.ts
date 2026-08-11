import {NextRequest,NextResponse} from "next/server";
import {authorized} from "@/lib/inventory";
import {ownerReviews,setReviewVisibility} from "@/lib/orders";
import {logActivity} from "@/lib/activity";
const owner=(request:NextRequest)=>authorized(request.cookies.get("fr_owner")?.value);
export async function GET(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({reviews:await ownerReviews()})}
export async function PATCH(request:NextRequest){if(!owner(request))return NextResponse.json({error:"Unauthorized"},{status:401});const {id,visible}=await request.json();const reviews=await setReviewVisibility(Number(id),Boolean(visible));await logActivity("Review visibility changed",`Review #${id} → ${visible?"public":"hidden"}`);return NextResponse.json({reviews})}
