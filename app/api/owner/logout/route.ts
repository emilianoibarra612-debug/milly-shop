import { NextResponse } from "next/server";
export async function POST() { const response = NextResponse.json({ ok: true }); response.cookies.set("fr_owner", "", { httpOnly: true, path: "/", maxAge: 0 }); return response; }
