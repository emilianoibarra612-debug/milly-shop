import { NextRequest, NextResponse } from "next/server";
import { authorized, readInventory, writeInventory } from "@/lib/inventory";
import {logActivity} from "@/lib/activity";
export const runtime = "nodejs";
export async function GET() { return NextResponse.json(await readInventory(), { headers: { "Cache-Control": "no-store" } }); }
export async function PATCH(request: NextRequest) {
  if (!authorized(request.cookies.get("fr_owner")?.value)) return NextResponse.json({ error: "Owner login required." }, { status: 401 });
  const { key, delta } = await request.json().catch(() => ({}));
  if (typeof key !== "string" || !Number.isInteger(delta) || Math.abs(delta) > 10000) return NextResponse.json({ error: "Invalid stock update." }, { status: 400 });
  const inventory = await readInventory(); if (!(key in inventory)) return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  const previous=inventory[key];inventory[key] = Math.max(0, inventory[key] + delta); await writeInventory(inventory);await logActivity("Stock changed",`${key}: ${previous} → ${inventory[key]}`); return NextResponse.json({ key, stock: inventory[key] });
}
