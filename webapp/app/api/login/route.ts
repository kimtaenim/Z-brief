import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthPassword, isAuthed, setAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

const Body = z.object({ password: z.string().min(1) });

export async function GET() {
  const required = getAuthPassword();
  return NextResponse.json({
    required: !!required,
    authed: required ? await isAuthed() : true,
  });
}

export async function POST(req: Request) {
  const required = getAuthPassword();
  if (!required) {
    return NextResponse.json({ ok: true, required: false });
  }
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  if (parsed.data.password !== required) {
    return NextResponse.json({ ok: false, error: "wrong_password" }, { status: 401 });
  }
  await setAuthCookie();
  return NextResponse.json({ ok: true, required: true });
}
