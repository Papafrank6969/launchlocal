const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ALIASES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  weds: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6,
};

type DayRange = { start: number; end: number; openMinutes: number; closeMinutes: number };

function parseDayToken(token: string): number | null {
  const key = token.trim().toLowerCase().slice(0, 4).replace(/[^a-z]/g, "");
  for (const alias of Object.keys(DAY_ALIASES)) {
    if (key.startsWith(alias)) return DAY_ALIASES[alias];
  }
  return null;
}

function parseDayRange(spec: string): [number, number] | null {
  const parts = spec.split("-").map((s) => s.trim());
  const start = parseDayToken(parts[0]);
  if (start === null) return null;
  if (parts.length === 1) return [start, start];
  const end = parseDayToken(parts[1]);
  if (end === null) return null;
  return [start, end];
}

function parseTime(spec: string): number | null {
  const m = spec.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Best-effort parse of lines like "Mon-Fri: 8am-6pm" / "Sat: 9am-2pm". Returns null if unparseable. */
export function parseHours(raw?: string | null): DayRange[] | null {
  if (!raw) return null;
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const ranges: DayRange[] = [];
  for (const line of lines) {
    const [daySpec, timeSpec] = line.split(":").map((s) => s?.trim());
    if (!daySpec || !timeSpec) return null;
    const dayRange = parseDayRange(daySpec);
    if (!dayRange) return null;
    const [openStr, closeStr] = timeSpec.split("-").map((s) => s.trim());
    const openMinutes = openStr ? parseTime(openStr) : null;
    const closeMinutes = closeStr ? parseTime(closeStr) : null;
    if (openMinutes === null || closeMinutes === null) return null;
    ranges.push({ start: dayRange[0], end: dayRange[1], openMinutes, closeMinutes });
  }
  return ranges;
}

export function isOpenNow(ranges: DayRange[], now = new Date()): boolean {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return ranges.some((r) => {
    const inDayRange = r.start <= r.end ? day >= r.start && day <= r.end : day >= r.start || day <= r.end;
    if (!inDayRange) return false;
    return r.closeMinutes > r.openMinutes
      ? minutes >= r.openMinutes && minutes < r.closeMinutes
      : minutes >= r.openMinutes || minutes < r.closeMinutes;
  });
}

export { DAY_NAMES };
