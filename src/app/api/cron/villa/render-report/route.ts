import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBrother } from "@/lib/brothers";
import { prismaRunnerDeps } from "@/lib/agentDeps";
import { runBrother } from "@/lib/agentRunner";
import { cronAllowed, EDITOR_ID, parseRenderReport, renderSummary } from "@/lib/villaRender";

export const dynamic = "force-dynamic";

// The render-posts GitHub Action reports its results here. Marks posts
// RENDERED/FAILED, logs the run as the Editor's, then hands a fresh video
// straight to the Poster (unless he's switched off on /villa).
export async function POST(req: NextRequest) {
  if (!cronAllowed(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = parseRenderReport(await req.json().catch(() => null));
  for (const r of results) {
    // Only DRAFTED posts move, so a replayed report can't clobber a POSTED one.
    await db.socialPost.updateMany({
      where: { id: r.id, status: "DRAFTED" },
      data: "videoUrl" in r ? { status: "RENDERED", videoUrl: r.videoUrl, error: null } : { status: "FAILED", error: r.error },
    });
  }

  const def = findBrother(EDITOR_ID)!;
  const now = new Date();
  const failedAll = results.length > 0 && results.every((r) => "error" in r);
  const status = failedAll ? "ERROR" : "IDLE";
  await db.agent.upsert({
    where: { id: def.id },
    create: { id: def.id, name: def.name, role: def.role, lastRunAt: now, status },
    update: { name: def.name, role: def.role, lastRunAt: now, status, currentTask: null },
  });
  await db.agentRun.create({
    data: {
      agentId: def.id,
      trigger: "CRON",
      outcome: failedAll ? "ERROR" : "OK",
      finishedAt: now,
      summary: renderSummary(results),
      error: failedAll ? results.map((r) => ("error" in r ? r.error : "")).join("; ").slice(0, 500) : null,
    },
  });
  let posted = null;
  if (results.some((r) => "videoUrl" in r)) {
    const poster = await db.agent.findUnique({ where: { id: "poster" }, select: { enabled: true } });
    if (poster?.enabled !== false) posted = await runBrother(findBrother("poster")!, "CRON", prismaRunnerDeps());
  }
  return NextResponse.json({ ok: true, recorded: results.length, posted });
}
