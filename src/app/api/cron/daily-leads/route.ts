import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractInstagramHandle, findBusinesses, scoreWebsite } from "@/lib/places";
import { rotateTargets, type LeadTarget } from "@/lib/leadTargets";
import {
  DAILY_LEAD_GOAL,
  MAX_SEARCHES_PER_RUN,
  selectNewLeads,
  summarizeRun,
  type CandidateBusiness,
} from "@/lib/leadCron";

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

  const state =
    (await db.cronState.findUnique({ where: { id: "daily-leads" } })) ??
    (await db.cronState.create({ data: { id: "daily-leads" } }));

  const knownPlaceIds = new Set(
    (
      await db.lead.findMany({
        where: { placeId: { not: null } },
        select: { placeId: true },
      })
    ).map((r) => r.placeId as string)
  );

  let cursor = state.cursor;
  let searches = 0;
  let added = 0;
  const areasHit: string[] = [];

  while (searches < MAX_SEARCHES_PER_RUN && added < DAILY_LEAD_GOAL) {
    const { batch, nextCursor } = rotateTargets(cursor, 1);
    const target: LeadTarget = batch[0];
    cursor = nextCursor;
    searches += 1;

    try {
      const raw = await findBusinesses(target.city, target.category);
      const candidates: CandidateBusiness[] = raw.map((b) => ({
        placeId: b.placeId ?? null,
        name: b.name,
        address: b.address,
        phone: b.phone,
        existingUrl: b.existingUrl,
        websiteStatus: scoreWebsite(b.existingUrl),
      }));

      // Only take as many as we still need — stop the moment the goal is hit
      // rather than banking a whole extra page.
      const fresh = selectNewLeads(candidates, knownPlaceIds).slice(
        0,
        DAILY_LEAD_GOAL - added
      );

      for (const b of fresh) {
        await db.lead.create({
          data: {
            name: b.name,
            category: target.category,
            address: b.address,
            city: target.city,
            phone: b.phone,
            existingUrl: b.existingUrl,
            instagramHandle: extractInstagramHandle(b.existingUrl),
            websiteStatus: b.websiteStatus,
            source: "GOOGLE_PLACES",
            placeId: b.placeId,
          },
        });
        knownPlaceIds.add(b.placeId as string);
        added += 1;
      }

      if (fresh.length > 0) {
        await db.event.createMany({
          data: fresh.map(() => ({ type: "LEAD_FOUND" as const })),
        });
        areasHit.push(`${target.city} ${target.category}`);
      }
    } catch (err) {
      console.error(`[daily-leads] search failed for ${target.city} ${target.category}:`, err);
    }
  }

  const note = summarizeRun({ added, searches, goal: DAILY_LEAD_GOAL, areasHit });

  await db.cronState.update({
    where: { id: "daily-leads" },
    data: { cursor, lastRunAt: new Date(), lastRunAdded: added, lastRunNote: note },
  });

  return NextResponse.json({
    added,
    searches,
    goal: DAILY_LEAD_GOAL,
    cursor,
    note,
  });
}
