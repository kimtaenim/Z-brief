import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { deleteBrief, loadBrief } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const record = await loadBrief(id);
  if (!record) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const ok = await deleteBrief(id);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
