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

  // GitHub's own schedule can start hours late, so kick the render ourselves
  // as soon as the Creative Director has written today's post.
  const wrote = results.some((r) => r.id === "creative-director" && r.outcome === "OK");
  const render = wrote ? await dispatchRender() : null;

  return NextResponse.json({ results, render });
}

// Needs GITHUB_DISPATCH_TOKEN: fine-grained PAT, this repo only, Actions: write.
async function dispatchRender(): Promise<string> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return "skipped: GITHUB_DISPATCH_TOKEN not set";
  const res = await fetch(
    "https://api.github.com/repos/Papafrank6969/launchlocal/actions/workflows/render-posts.yml/dispatches",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "master" }),
    }
  );
  if (res.ok) return "dispatched";
  const err = `dispatch failed: HTTP ${res.status} ${await res.text()}`;
  console.error(err);
  return err;
}
