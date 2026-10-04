import { NextResponse } from "next/server";
import { prismaRunnerDeps } from "@/lib/agentDeps";
import { runBrother } from "@/lib/agentRunner";
import { findBrother } from "@/lib/brothers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Behind the operator password (src/proxy.ts). Runs one brother now.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const def = findBrother(id);
  if (!def) {
    return NextResponse.json({ error: `No brother "${id}"` }, { status: 404 });
  }

  return NextResponse.json(await runBrother(def, "MANUAL", prismaRunnerDeps()));
}
