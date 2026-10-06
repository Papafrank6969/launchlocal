import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prismaRunnerDeps } from "@/lib/agentDeps";
import { runBrother, type RunResult } from "@/lib/agentRunner";
import { BROTHERS } from "@/lib/brothers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth =
      req.headers.get("authorization") === `Bearer ${secret}`;
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const deps = prismaRunnerDeps();
  const disabled = new Set(
    (await db.agent.findMany({ where: { enabled: false }, select: { id: true } })).map((a) => a.id)
  );
  const results: RunResult[] = [];

  // Sequential on purpose: keeps the budget check accurate between brothers.
  // runBrother upserts the Agent row, so new brothers register themselves.
  for (const def of BROTHERS) {
    if (disabled.has(def.id) || def.cron === false) continue;
    results.push(await runBrother(def, "CRON", deps));
  }

  return NextResponse.json({ results });
}
