import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildSiteNav } from "@/lib/siteNav";
import {
  HANDOFF_STEPS,
  HANDOFF_STEP_KEYS,
  reconcileHandoffTasks,
  buildHandoffProgress,
  handoffSummaryText,
} from "@/lib/handoff";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type HandoffTaskRow = {
  key: string;
  done: boolean;
  doneAt: Date | null;
  order: number;
};

async function loadSite(id: string) {
  return db.site.findUnique({
    where: { id },
    include: {
      lead: true,
      _count: {
        select: {
          serviceItems: true,
          blogPosts: { where: { published: true } },
          galleryItems: true,
          faqItems: true,
        },
      },
    },
  });
}

async function loadTasks(siteId: string): Promise<HandoffTaskRow[]> {
  return db.handoffTask.findMany({
    where: { siteId },
    select: { key: true, done: true, doneAt: true, order: true },
  });
}

function toCanonicalTasks(siteId: string, rows: HandoffTaskRow[]) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return HANDOFF_STEPS.map((step, i) => {
    const row = byKey.get(step.key);
    return {
      key: step.key,
      label: step.label,
      help: step.help,
      done: row?.done ?? false,
      doneAt: row?.doneAt ? row.doneAt.toISOString() : null,
      order: row?.order ?? i,
    };
  });
}

function buildSummary(src: {
  site: Awaited<ReturnType<typeof loadSite>>;
  rows: HandoffTaskRow[];
}) {
  if (!src.site) return null;
  const site = src.site;
  const navLinks = buildSiteNav(site.slug, {
    hasAbout: Boolean(site.story || site.about),
    hasServices: site._count.serviceItems > 0,
    hasBlogPosts: site._count.blogPosts > 0,
    hasGalleryItems: site._count.galleryItems > 0,
    hasFaqItems: site._count.faqItems > 0,
  });
  const liveUrl = `${SITE_BASE}/s/${site.slug}`;
  const customDomain = site.customDomain?.trim() || null;
  const summary = handoffSummaryText({
    businessName: site.businessName,
    liveUrl,
    customDomain,
    pages: navLinks.map((n) => n.label),
    contactEmail: site.email || null,
  });
  return { summary, customDomain, liveUrl };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await loadSite(id);
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let rows = await loadTasks(id);

  const missing = reconcileHandoffTasks(rows.map((r) => r.key));
  if (missing.length > 0) {
    try {
      await db.handoffTask.createMany({
        data: missing.map((m) => ({ siteId: id, key: m.key, order: m.order })),
      });
    } catch (err) {
      // SQLite has no `skipDuplicates`, so a concurrent backfill that hits the
      // @@unique([siteId, key]) is a P2002 we safely treat as a no-op.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
    }
    rows = await loadTasks(id);
  }

  const progress = buildHandoffProgress(rows);
  const built = buildSummary({ site, rows });

  return NextResponse.json({
    tasks: toCanonicalTasks(id, rows),
    progress,
    summary: built?.summary ?? "",
    customDomain: built?.customDomain ?? null,
    deliveredAt: site.deliveredAt ? site.deliveredAt.toISOString() : null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const key = typeof body.key === "string" ? body.key : "";
  if (!HANDOFF_STEP_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown handoff step" }, { status: 400 });
  }

  const site = await loadSite(id);
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const done = Boolean(body.done);
  const canonicalOrder = HANDOFF_STEPS.findIndex((s) => s.key === key);

  await db.handoffTask.upsert({
    where: { siteId_key: { siteId: id, key } },
    create: { siteId: id, key, done, doneAt: done ? new Date() : null, order: canonicalOrder },
    update: { done, doneAt: done ? new Date() : null },
  });

  const rows = await loadTasks(id);
  const progress = buildHandoffProgress(rows);

  let deliveredAt = site.deliveredAt;

  // Delivery transition — best effort; must never fail the toggle.
  try {
    if (progress.complete && !deliveredAt) {
      await db.site.update({ where: { id }, data: { deliveredAt: new Date() } });
      await db.event.create({ data: { type: "SITE_DELIVERED", siteId: id } });
      deliveredAt = new Date();
    } else if (!progress.complete && deliveredAt) {
      await db.site.update({ where: { id }, data: { deliveredAt: null } });
      deliveredAt = null;
    }
  } catch (err) {
    console.error("handoff delivery transition failed:", err);
  }

  const built = buildSummary({ site, rows });

  return NextResponse.json({
    tasks: toCanonicalTasks(id, rows),
    progress,
    summary: built?.summary ?? "",
    customDomain: built?.customDomain ?? null,
    deliveredAt: deliveredAt ? deliveredAt.toISOString() : null,
  });
}
