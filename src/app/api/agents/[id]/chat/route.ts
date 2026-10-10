import { NextResponse } from "next/server";
import { prismaRunnerDeps } from "@/lib/agentDeps";
import { chatTurn } from "@/lib/agentChat";
import { findBrother } from "@/lib/brothers";
import { chatStore } from "@/lib/brothers/brotherData";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Behind the operator password (src/proxy.ts). One metered chat turn.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const def = findBrother(id);
  if (!def) return NextResponse.json({ error: `No brother "${id}"` }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;

  const result = await chatTurn(def, body?.message, { ...prismaRunnerDeps(), ...chatStore });

  return result.ok
    ? NextResponse.json({ reply: result.reply, costMicros: result.costMicros })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
