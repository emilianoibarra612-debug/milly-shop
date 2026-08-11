import { NextRequest,NextResponse } from "next/server";
import { authorized } from "@/lib/inventory";
import { databaseBackup } from "@/lib/orders";
export async function GET(request:NextRequest){if(!authorized(request.cookies.get("fr_owner")?.value))return NextResponse.json({error:"Unauthorized"},{status:401});const backup=await databaseBackup();return new NextResponse(JSON.stringify(backup,null,2),{headers:{"Content-Type":"application/json","Content-Disposition":`attachment; filename="foreverrepent-backup-${new Date().toISOString().slice(0,10)}.json"`,"Cache-Control":"no-store"}})}
