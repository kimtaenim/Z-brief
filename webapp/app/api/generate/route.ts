import { NextResponse } from "next/server";
import { z } from "zod";
import { checkAndIncrementQuota, isAuthed } from "@/lib/auth";
import { saveBrief } from "@/lib/cache";
import { runPipeline } from "@/lib/pipeline";
import type { SectionId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const SectionEnum = z.enum([
  "overview",
  "onprem_ai",
  "physical_ai",
  "vertical_ai",
  "security_pqc",
  "valuation",
  "energy",
]);

const Body = z.object({
  sections: z.array(SectionEnum).min(1),
  userInterest: z.string().max(2000).optional(),
  anchorDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "anchorDate must be YYYY-MM-DD")
    .optional(),
});

function getIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const ip = getIp(req);
  const quota = await checkAndIncrementQuota(ip);
  if (!quota.ok) {
    return NextResponse.json(
      { error: "quota_exceeded", limit: quota.limit, remaining: 0 },
      { status: 429 },
    );
  }

  try {
    const record = await runPipeline({
      sections: parsed.data.sections as SectionId[],
      userInterest: parsed.data.userInterest,
      anchorDate: parsed.data.anchorDate,
    });
    await saveBrief(record);
    return NextResponse.json({
      id: record.id,
      mode: record.meta.mode,
      remaining: quota.remaining,
      limit: quota.limit,
      cost: record.meta.cost,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "pipeline_failed", detail: message }, { status: 500 });
  }
}
