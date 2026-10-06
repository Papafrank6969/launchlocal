import { NextRequest, NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { db } from "@/lib/db";
import { cronAllowed } from "@/lib/villaRender";

export const dynamic = "force-dynamic";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VALID_MS = 15 * 60 * 1000;

// The render-posts Action asks for a short-lived PUT URL per video, so it never
// holds a Blob token: the app signs with its own Vercel credentials (OIDC).
export async function POST(req: NextRequest) {
  if (!cronAllowed(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = ((await req.json().catch(() => null)) ?? {}) as { id?: unknown };
  if (typeof id !== "string") return NextResponse.json({ error: "id required" }, { status: 400 });
  const post = await db.socialPost.findFirst({ where: { id, status: "DRAFTED" }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "no DRAFTED post with that id" }, { status: 404 });

  const pathname = `villa/${post.id}.mp4`;
  const validUntil = Date.now() + VALID_MS;
  const token = await issueSignedToken({ pathname, operations: ["put"], validUntil, allowedContentTypes: ["video/mp4"], maximumSizeInBytes: MAX_VIDEO_BYTES });
  const { presignedUrl } = await presignUrl(token, {
    operation: "put",
    access: "public",
    pathname,
    validUntil,
    allowedContentTypes: ["video/mp4"],
    maximumSizeInBytes: MAX_VIDEO_BYTES,
    allowOverwrite: true,
  });
  return NextResponse.json({ uploadUrl: presignedUrl });
}
