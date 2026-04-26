import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { listRecent } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ items: [], authed: false });
  }
  const items = await listRecent(5);
  return NextResponse.json({ items, authed: true });
}
