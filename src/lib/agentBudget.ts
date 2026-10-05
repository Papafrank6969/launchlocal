export const DAILY_BUDGET_MICROS = 1_000_000; // $1.00/day across all brothers

const ET = "America/New_York";

// Offset of New York from UTC at `at`, in ms (negative: -4h EDT, -5h EST).
function etOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Midnight in New York on the ET calendar day containing `now`. */
export function startOfDayET(now: Date): Date {
  const [m, d, y] = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
    .format(now)
    .split("/")
    .map(Number);
  // DST switches at 2am local, so the offset at 04:00 UTC (≤ midnight ET) is
  // the offset in force at that day's midnight.
  const offset = etOffsetMs(new Date(Date.UTC(y, m - 1, d, 4)));
  return new Date(Date.UTC(y, m - 1, d) - offset);
}

export function canSpend(spentMicros: number, capMicros: number = DAILY_BUDGET_MICROS): boolean {
  return spentMicros < capMicros;
}

/** `AGENT_DAILY_BUDGET_MICROS` override; anything but a positive integer falls back to the default. */
export function budgetFromEnv(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) return DAILY_BUDGET_MICROS;
  const n = Number(value);
  return n > 0 ? n : DAILY_BUDGET_MICROS;
}
