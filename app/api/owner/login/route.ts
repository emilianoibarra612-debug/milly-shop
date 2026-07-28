import { NextResponse } from "next/server";
import { makeSession, validLogin } from "@/lib/inventory";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const { username, password } = await request.json().catch(() => ({}));
  if (typeof username !== "string" || typeof password !== "string" || !validLogin(username, password)) return NextResponse.json({ error: "Invalid owner credentials." }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("fr_owner", makeSession(), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}
