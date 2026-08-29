/**
 * Pure funnel aggregation for `/stats`.
 *
 * Turns the raw `Lead` + `Event` rows into (a) the stage funnel and (b) the
 * per-day time series that appear on the Stats page. Deliberately has no Prisma
 * or React imports - it operates on structural types so it stays trivially
 * testable and the page just wires up the results.
 *
 * The funnel unions two signals: lifecycle `Event` rows (LEAD_CONTACTED,
 * LEAD_RESPONDED, LEAD_WON) and the *current* `outreachStatus` of each lead.
 * The union matters because this feature started recording events on deploy, so
 * any lead advanced before then has no events but is still correctly counted by
 * its present status.
 */

export type FunnelLead = {
  id: string;
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
  outreachStatus: "NEW" | "CONTACTED" | "RESPONDED" | "WON" | "LOST";
};

export type FunnelEvent = {
  type: string; // EventType as string
  leadId: string | null;
  siteId: string | null;
  createdAt: string; // ISO
};

export type FunnelStageKey = "found" | "opportunity" | "contacted" | "responded" | "won";

export type FunnelStage = {
  key: FunnelStageKey;
  label: string;
  count: number;
  ofPreviousPct: number | null;
};

export const FUNNEL_STAGE_KEYS: FunnelStageKey[] = ["found", "opportunity", "contacted", "responded", "won"];

export const FUNNEL_STAGE_LABELS: Record<FunnelStageKey, string> = {
  found: "Leads found",
  opportunity: "Opportunities",
  contacted: "Contacted",
  responded: "Responded",
  won: "Won",
};

export type FunnelEventTypeKey = "LEAD_CONTACTED" | "LEAD_RESPONDED" | "LEAD_WON" | "CONTACT_SUBMITTED";

const ADVANCED_STATUSES = ["CONTACTED", "RESPONDED", "WON", "LOST"];
const RESPONDED_OR_WON = ["RESPONDED", "WON"];

/**
 * The ordered funnel stages, built as strictly-nested id sets from the top:
 *   1. found        - every lead
 *   2. opportunity  - leads without a site (websiteStatus !== "HAS_SITE") ∪ any
 *                     engaged lead (has a lifecycle event OR an advanced status)
 *   3. contacted    - (LEAD_CONTACTED events ∪ CONTACTED/RESPONDED/WON/LOST)
 *                     ∩ opportunity
 *   4. responded    - (LEAD_RESPONDED events ∪ RESPONDED/WON) ∩ contacted
 *   5. won          - (LEAD_WON events ∪ WON) ∩ responded
 *
 * Nesting top-down guarantees the funnel is monotonic by construction: a lead
 * with a site and an advanced status (e.g. HAS_SITE/WON) stays in `opportunity`
 * via the engaged-union, so a lower stage can never exceed the one above it.
 * The union with current status keeps pre-events-era leads counted. Each stage
 * is deduped by id (a lead with both an event and the matching status counts
 * once). `ofPreviousPct` is round(count / previous.count * 100), 0 when the
 * previous stage is 0; the first stage has none.
 */
export function buildFunnel(leads: FunnelLead[], events: FunnelEvent[]): FunnelStage[] {
  const allIds = new Set(leads.map((l) => l.id));

  const idsInStatus = (statuses: string[]) => new Set(leads.filter((l) => statuses.includes(l.outreachStatus)).map((l) => l.id));
  const idsWithEvent = (type: string) =>
    new Set(events.filter((e) => e.type === type).map((e) => e.leadId).filter((id): id is string => id != null));

  const engagedEventIds = unionSets(
    unionSets(idsWithEvent("LEAD_CONTACTED"), idsWithEvent("LEAD_RESPONDED")),
    idsWithEvent("LEAD_WON"),
  );
  const engagedIds = unionSets(engagedEventIds, idsInStatus(ADVANCED_STATUSES));

  const opportunityIds = unionSets(
    new Set(leads.filter((l) => l.websiteStatus !== "HAS_SITE").map((l) => l.id)),
    engagedIds,
  );
  const contactedIds = intersect(engagedIds, opportunityIds);
  const respondedIds = intersect(
    unionSets(idsWithEvent("LEAD_RESPONDED"), idsInStatus(RESPONDED_OR_WON)),
    contactedIds,
  );
  const wonIds = intersect(unionSets(idsWithEvent("LEAD_WON"), idsInStatus(["WON"])), respondedIds);

  const counts = [allIds.size, opportunityIds.size, contactedIds.size, respondedIds.size, wonIds.size];

  return FUNNEL_STAGE_KEYS.map((key, i) => {
    const count = counts[i];
    const previous = counts[i - 1];
    const ofPreviousPct = i === 0 ? null : previous > 0 ? Math.round((count / previous) * 100) : 0;
    return { key, label: FUNNEL_STAGE_LABELS[key], count, ofPreviousPct };
  });
}

function unionSets(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a, ...b]);
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a].filter((x) => b.has(x)));
}

export type DayRow = {
  date: string;
  contacted: number;
  responded: number;
  won: number;
  contactForm: number;
};

type DayRowSeriesKey = Exclude<keyof DayRow, "date">;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const SERIES_BY_TYPE: Record<FunnelEventTypeKey, DayRowSeriesKey> = {
  LEAD_CONTACTED: "contacted",
  LEAD_RESPONDED: "responded",
  LEAD_WON: "won",
  CONTACT_SUBMITTED: "contactForm",
};

/**
 * One row per day for the last `days` days (oldest first), counting raw events
 * of the four funnel types by their `createdAt` day (local midnight buckets),
 * matching the existing SITE_VIEW series so the charts line up. Days without
 * events are present as zeros.
 */
export function funnelEventsByDay(events: FunnelEvent[], days: number, now: Date = new Date()): DayRow[] {
  const today = startOfDay(now);
  const rows: { day: Date; row: DayRow }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    rows.push({
      day,
      row: {
        date: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        contacted: 0,
        responded: 0,
        won: 0,
        contactForm: 0,
      },
    });
  }

  for (const ev of events) {
    const bucket = SERIES_BY_TYPE[ev.type as FunnelEventTypeKey];
    if (!bucket) continue;
    const evDay = startOfDay(new Date(ev.createdAt)).getTime();
    const hit = rows.find((r) => r.day.getTime() === evDay);
    if (hit) hit.row[bucket] += 1;
  }

  return rows.map(({ row }) => row);
}
