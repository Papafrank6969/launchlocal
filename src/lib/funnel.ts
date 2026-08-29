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
 * The ordered funnel stages:
 *   1. found        - every lead
 *   2. opportunity  - leads without a site (websiteStatus !== "HAS_SITE")
 *   3. contacted    - distinct LEAD_CONTACTED leadIds ∪ leads currently
 *                     CONTACTED/RESPONDED/WON/LOST
 *   4. responded    - distinct LEAD_RESPONDED leadIds ∪ leads currently
 *                     RESPONDED/WON
 *   5. won          - distinct LEAD_WON leadIds ∪ leads currently WON
 *
 * Each `count` is the union of the two sources, deduped by id, so a lead with
 * both an event and the matching current status counts once. `ofPreviousPct` is
 * round(count / previous.count * 100), 0 when the previous stage is 0; the first
 * stage has none.
 */
export function buildFunnel(leads: FunnelLead[], events: FunnelEvent[]): FunnelStage[] {
  const idsInStatus = (statuses: string[]) => new Set(leads.filter((l) => statuses.includes(l.outreachStatus)).map((l) => l.id));
  const idsWithEvent = (type: string) =>
    new Set(events.filter((e) => e.type === type).map((e) => e.leadId).filter((id): id is string => id != null));

  const contacted = union(idsWithEvent("LEAD_CONTACTED"), idsInStatus(ADVANCED_STATUSES));
  const responded = union(idsWithEvent("LEAD_RESPONDED"), idsInStatus(RESPONDED_OR_WON));
  const won = union(idsWithEvent("LEAD_WON"), idsInStatus(["WON"]));

  const counts: FunnelStageKey[] = ["found", "opportunity", "contacted", "responded", "won"];
  const raw = [leads.length, leads.filter((l) => l.websiteStatus !== "HAS_SITE").length, contacted, responded, won];

  return counts.map((key, i) => {
    const count = raw[i];
    const previous = raw[i - 1];
    const ofPreviousPct = i === 0 ? null : previous > 0 ? Math.round((count / previous) * 100) : 0;
    return { key, label: FUNNEL_STAGE_LABELS[key], count, ofPreviousPct };
  });
}

function union(a: Set<string>, b: Set<string>): number {
  return new Set([...a, ...b]).size;
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
