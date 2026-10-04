import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBrother } from "@/lib/brothers";
import { CHAT_HISTORY } from "@/lib/agentChat";

export const dynamic = "force-dynamic";

// Behind the operator password (src/proxy.ts). One brother's panel data.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!findBrother(id) && !(await db.agent.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ error: `No brother "${id}"` }, { status: 404 });
  }

  const [runs, tasks, approvals, messages] = await Promise.all([
    db.agentRun.findMany({
      where: { agentId: id, trigger: { not: "CHAT" } },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { id: true, trigger: true, outcome: true, summary: true, error: true, costMicros: true, startedAt: true },
    }),
    db.agentTask.findMany({
      where: { agentId: id, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, leadId: true, createdAt: true },
    }),
    db.approval.findMany({
      where: { agentId: id, state: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, title: true, body: true, createdAt: true },
    }),
    db.agentMessage.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
      take: CHAT_HISTORY,
      select: { id: true, role: true, content: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({ runs, tasks, approvals, messages: messages.reverse() });
}

export type AgentDetail = {
  runs: { id: string; trigger: string; outcome: string | null; summary: string | null; error: string | null; costMicros: number; startedAt: string }[];
  tasks: { id: string; kind: string; leadId: string | null; createdAt: string }[];
  approvals: { id: string; kind: string; title: string; body: string; createdAt: string }[];
  messages: { id: string; role: string; content: string; createdAt: string }[];
};
