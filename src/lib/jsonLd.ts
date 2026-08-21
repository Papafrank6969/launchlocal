import { parseHours, DAY_NAMES } from "@/lib/hours";

const FULL_DAY_NAMES: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function daysInRange(start: number, end: number): string[] {
  const days: string[] = [];
  let i = start;
  while (true) {
    days.push(FULL_DAY_NAMES[DAY_NAMES[i]]);
    if (i === end) break;
    i = (i + 1) % 7;
  }
  return days;
}

export type LocalBusinessInput = {
  businessName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  hours?: string | null;
  photoUrl?: string | null;
};

export function localBusinessJsonLd(site: LocalBusinessInput, baseUrl: string, path: string): Record<string, unknown> {
  const ranges = parseHours(site.hours);
  const url = `${baseUrl}${path}`;

  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.businessName,
    url,
  };

  if (site.phone) json.telephone = site.phone;
  if (site.email) json.email = site.email;
  if (site.address) json.address = site.address;
  if (site.photoUrl) json.image = `${baseUrl}${site.photoUrl}`;
  if (ranges) {
    json.openingHoursSpecification = ranges.map((r) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: daysInRange(r.start, r.end),
      opens: minutesToTime(r.openMinutes),
      closes: minutesToTime(r.closeMinutes),
    }));
  }

  return json;
}
