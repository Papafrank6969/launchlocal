/**
 * The footer photo-credit line can carry photos from more than one source
 * (Google Places + Pexels). Each source owns one `"<Prefix> — <names>"` segment;
 * these helpers add / replace / drop a source's segment without disturbing the
 * others.
 */

const SEP = "  ·  ";

function segments(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

function join(parts: string[]): string | null {
  return parts.length > 0 ? parts.join(SEP) : null;
}

/** Add or replace one source's segment (`line` = `"<Prefix> — <names>"`). */
export function mergeAttribution(existing: string | null | undefined, line: string): string | null {
  const prefix = line.split(" — ")[0];
  const kept = segments(existing).filter((s) => s.split(" — ")[0] !== prefix);
  return join([...kept, line]);
}

/** Drop the segment for a source, e.g. `removeAttribution(x, "Photos via Pexels")`. */
export function removeAttribution(existing: string | null | undefined, prefix: string): string | null {
  return join(segments(existing).filter((s) => s.split(" — ")[0] !== prefix));
}
