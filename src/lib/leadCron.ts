export const DAILY_LEAD_GOAL = 25;
export const MAX_SEARCHES_PER_RUN = 6;

export type CandidateBusiness = {
  placeId: string | null;
  name: string;
  address: string;
  phone?: string | null;
  existingUrl?: string | null;
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
};

export function qualifies(b: CandidateBusiness): boolean {
  if (b.websiteStatus === "HAS_SITE") return false;
  return typeof b.phone === "string" && b.phone.length > 0;
}

export function selectNewLeads(
  candidates: CandidateBusiness[],
  knownPlaceIds: Set<string>
): CandidateBusiness[] {
  const seen = new Set<string>();
  const fresh: CandidateBusiness[] = [];
  for (const b of candidates) {
    if (!qualifies(b)) continue;
    if (!b.placeId) continue;
    if (knownPlaceIds.has(b.placeId) || seen.has(b.placeId)) continue;
    seen.add(b.placeId);
    fresh.push(b);
  }
  return fresh;
}

export function summarizeRun(input: {
  added: number;
  searches: number;
  goal: number;
  areasHit: string[];
}): string {
  const { added, searches, goal, areasHit } = input;
  const areas = areasHit.length > 0 ? areasHit.join(", ") : "none";
  if (added >= goal) {
    return `added ${added}/${goal} in ${searches} searches — ${areas}`;
  }
  return `added ${added}/${goal} (search cap hit) — ${areas}`;
}
