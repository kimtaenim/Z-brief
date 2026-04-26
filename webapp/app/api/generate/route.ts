import { NextResponse } from "next/server";
import { checkAndIncrementQuota, isAuthed } from "@/lib/auth";
import { saveBrief } from "@/lib/cache";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  const ip = getIp(req);
  const quota = await checkAndIncrementQuota(ip);
  if (!quota.ok) {
    return NextResponse.json(
      { error: "quota_exceeded", limit: quota.limit, remaining: 0 },
      { status: 429 },
    );
  }

  try {
    const record = await runPipeline();
    await saveBrief(record);
    return NextResponse.json({
      id: record.id,
      mode: record.meta.mode,
      remaining: quota.remaining,
      limit: quota.limit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "pipeline_failed", detail: message }, { status: 500 });
  }
}
