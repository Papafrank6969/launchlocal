import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAllowed, RENDER_BATCH } from "@/lib/villaRender";

export const dynamic = "force-dynamic";

// Called by the render-posts GitHub Action: the next DRAFTED posts to render.
export async function GET(req: NextRequest) {
  if (!cronAllowed(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const posts = await db.socialPost.findMany({
    where: { status: "DRAFTED" },
    orderBy: { createdAt: "asc" },
    take: RENDER_BATCH,
    select: { id: true, audience: true, hook: true, spec: true },
  });
  return NextResponse.json({
    posts: posts.map((p) => ({ id: p.id, audience: p.audience, hook: p.hook, beats: (p.spec as { beats?: string[] }).beats ?? [] })),
  });
}
