import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prismaRunnerDeps } from "@/lib/agentDeps";
import { chatTurn, CHAT_HISTORY, type ChatMessage } from "@/lib/agentChat";
import { findBrother } from "@/lib/brothers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Behind the operator password (src/proxy.ts). One metered chat turn.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const def = findBrother(id);
  if (!def) return NextResponse.json({ error: `No brother "${id}"` }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;

  const result = await chatTurn(def, body?.message, {
    ...prismaRunnerDeps(),
    loadContext: async (agentId) => {
      const [runs, drafts, history] = await Promise.all([
        db.agentRun.findMany({
          where: { agentId, trigger: { not: "CHAT" } },
          orderBy: { startedAt: "desc" },
          take: 5,
          select: { outcome: true, summary: true },
        }),
        db.approval.findMany({ where: { agentId, state: "PENDING" }, select: { title: true } }),
        db.agentMessage.findMany({
          where: { agentId },
          orderBy: { createdAt: "desc" },
          take: CHAT_HISTORY,
          select: { role: true, content: true },
        }),
      ]);
      return { runs, drafts: drafts.map((d) => d.title), history: history.reverse() as ChatMessage[] };
    },
    saveMessages: async (agentId, user, reply) => {
      const now = Date.now();
      await db.agentMessage.createMany({
        data: [
          { agentId, role: "user", content: user, createdAt: new Date(now) },
          { agentId, role: "assistant", content: reply, createdAt: new Date(now + 1) },
        ],
      });
    },
  });

  return result.ok
    ? NextResponse.json({ reply: result.reply, costMicros: result.costMicros })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
