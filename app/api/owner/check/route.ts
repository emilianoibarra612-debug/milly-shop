import {NextRequest,NextResponse} from "next/server";
import {authorized} from "@/lib/inventory";
import {testDiscordAlert} from "@/lib/discord";
export async function POST(request:NextRequest){if(!authorized(request.cookies.get("fr_owner")?.value))return NextResponse.json({error:"Unauthorized"},{status:401});const result=await testDiscordAlert();return NextResponse.json(result,{status:result.ok?200:502,headers:{"Cache-Control":"no-store"}})}
