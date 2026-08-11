import { NextRequest, NextResponse } from "next/server";
import { authorized, makeSession, validLogin, validTotp } from "@/lib/inventory";
import { activeTwoFactorSecret, loginAllowed, recordLogin } from "@/lib/orders";
export const runtime = "nodejs";
export async function GET(request:NextRequest){return NextResponse.json({twoFactorEnabled:Boolean(await activeTwoFactorSecret()),authenticated:authorized(request.cookies.get("fr_owner")?.value)},{headers:{"Cache-Control":"no-store"}})}
export async function POST(request: Request) {
  const ip=request.headers.get("cf-connecting-ip")||request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
  if(!await loginAllowed(ip))return NextResponse.json({error:"Too many attempts. Try again in 15 minutes."},{status:429});
  const { username, password, otp } = await request.json().catch(() => ({}));
  if (typeof username !== "string" || typeof password !== "string" || !validLogin(username, password)){await recordLogin(ip,false);return NextResponse.json({ error: "Invalid owner credentials." }, { status: 401 });}
  const twoFactorSecret=await activeTwoFactorSecret();
  if(twoFactorSecret&&!validTotp(String(otp||""),twoFactorSecret)){await recordLogin(ip,false);return NextResponse.json({error:"Invalid authenticator code."},{status:401})}
  await recordLogin(ip,true);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("fr_owner", makeSession(), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 2 });
  return response;
}
