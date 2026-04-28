import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { listAll } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ items: [], authed: false });
  }
  const items = await listAll();
  return NextResponse.json({ items, authed: true });
}
