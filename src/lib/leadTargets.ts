export type LeadTarget = { city: string; category: string };

const NYC_CITIES = [
  "Manhattan, NY",
  "Harlem, NY",
  "Washington Heights, NY",
  "Brooklyn, NY",
  "Williamsburg, Brooklyn, NY",
  "Bushwick, Brooklyn, NY",
  "Bedford-Stuyvesant, Brooklyn, NY",
  "Flatbush, Brooklyn, NY",
  "Bay Ridge, Brooklyn, NY",
  "Park Slope, Brooklyn, NY",
  "Astoria, Queens, NY",
  "Long Island City, NY",
  "Flushing, Queens, NY",
  "Jamaica, Queens, NY",
  "Ridgewood, Queens, NY",
  "Forest Hills, NY",
  "The Bronx, NY",
  "Fordham, Bronx, NY",
  "Staten Island, NY",
];

const NASSAU_CITIES = [
  "Hempstead, NY",
  "Long Beach, NY",
  "Freeport, NY",
  "Rockville Centre, NY",
  "Garden City, NY",
  "Mineola, NY",
  "Hicksville, NY",
  "Levittown, NY",
  "Massapequa, NY",
  "Farmingdale, NY",
  "Valley Stream, NY",
  "Elmont, NY",
  "Westbury, NY",
  "Glen Cove, NY",
];

const SUFFOLK_CITIES = [
  "Huntington, NY",
  "Babylon, NY",
  "Islip, NY",
  "Patchogue, NY",
  "Bay Shore, NY",
  "Central Islip, NY",
  "Brentwood, NY",
  "Riverhead, NY",
  "Smithtown, NY",
  "Commack, NY",
  "Deer Park, NY",
  "Lindenhurst, NY",
  "Copiague, NY",
  "Amityville, NY",
];

function expand(cities: string[]): LeadTarget[] {
  return cities.flatMap((city) => [
    { city, category: "barber" as const },
    { city, category: "salon" as const },
  ]);
}

export const LEAD_TARGETS: LeadTarget[] = [
  ...expand(NYC_CITIES),
  ...expand(NASSAU_CITIES),
  ...expand(SUFFOLK_CITIES),
];

export function rotateTargets(
  cursor: number,
  count: number,
  targets: LeadTarget[] = LEAD_TARGETS
): { batch: LeadTarget[]; nextCursor: number } {
  if (targets.length === 0) return { batch: [], nextCursor: 0 };
  const start = ((cursor % targets.length) + targets.length) % targets.length;
  const batch: LeadTarget[] = [];
  for (let i = 0; i < count; i++) {
    batch.push(targets[(start + i) % targets.length]);
  }
  return { batch, nextCursor: (start + count) % targets.length };
}
