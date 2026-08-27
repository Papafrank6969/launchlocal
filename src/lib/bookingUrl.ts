/**
 * A booking link is the primary CTA for the businesses LaunchLocal targets
 * (lash / nail / brow techs) — they take appointments through Vagaro, Booksy,
 * Square, GlossGenius, Calendly, Fresha, and friends, not a contact form.
 *
 * The operator pastes whatever the provider gave them; we normalise it to a
 * safe absolute `https://` URL (or `null` if it can't be trusted) so it's
 * never rendered as a raw `href` we haven't vetted.
 */

/** Normalise an operator-pasted booking link to a safe absolute URL, or null. */
export function normalizeBookingUrl(raw?: string | null): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  const hasAuthority = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);

  // A scheme with no `//` authority is mailto:/tel:/javascript:/data: — reject it.
  if (hasScheme && !hasAuthority) return null;

  // Bare domain / path — assume https rather than rejecting it.
  if (!hasAuthority) {
    value = value.startsWith("//") ? `https:${value}` : `https://${value}`;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  // Only ever emit http(s) — blocks javascript:, data:, mailto:, tel: etc.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  // Upgrade plain http to https — every mainstream booking host supports it.
  if (url.protocol === "http:") url.protocol = "https:";

  // Must look like a real public host (has a dot, not just "localhost").
  if (!url.hostname.includes(".")) return null;

  return url.toString();
}

const PROVIDERS: { label: string; match: RegExp }[] = [
  { label: "Vagaro", match: /(^|\.)vagaro\.com$/ },
  { label: "Booksy", match: /(^|\.)booksy\.com$/ },
  { label: "GlossGenius", match: /(^|\.)glossgenius\.com$/ },
  { label: "Square", match: /(^|\.)(squareup\.com|square\.site|square\.online)$/ },
  { label: "Calendly", match: /(^|\.)calendly\.com$/ },
  { label: "Fresha", match: /(^|\.)fresha\.com$/ },
  { label: "Acuity Scheduling", match: /(^|\.)(acuityscheduling\.com|app\.squarespacescheduling\.com)$/ },
  { label: "Setmore", match: /(^|\.)setmore\.com$/ },
  { label: "Schedulicity", match: /(^|\.)schedulicity\.com$/ },
  { label: "StyleSeat", match: /(^|\.)styleseat\.com$/ },
];

/** A friendly provider name for a normalised booking URL, or null if unrecognised. */
export function bookingProviderLabel(normalizedUrl?: string | null): string | null {
  if (!normalizedUrl) return null;
  let host: string;
  try {
    host = new URL(normalizedUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  return PROVIDERS.find((p) => p.match.test(host))?.label ?? null;
}
