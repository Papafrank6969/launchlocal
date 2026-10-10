import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EMAIL_RE } from "@/lib/brothers/mailer";

export const dynamic = "force-dynamic";

// Behind the operator password (src/proxy.ts). Adds contacts to the Mailer's
// sequence: {"source": "...", "contacts": [{"email", "firstName"?, "company"?}]}.
// Existing contacts and anyone on the suppression list are skipped, so a
// re-import can never re-message an opt-out.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { source?: unknown; contacts?: unknown } | null;
  if (!body || !Array.isArray(body.contacts)) return NextResponse.json({ error: 'Send {"contacts": [...]}' }, { status: 400 });
  const source = typeof body.source === "string" ? body.source.slice(0, 100) : "";

  const rows = new Map<string, { email: string; firstName: string; company: string; source: string }>();
  let invalid = 0;
  for (const c of body.contacts as Record<string, unknown>[]) {
    const email = typeof c?.email === "string" ? c.email.trim().toLowerCase() : "";
    if (!(email.match(EMAIL_RE)?.[0] === email)) {
      invalid++;
      continue;
    }
    const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
    rows.set(email, { email, firstName: str(c.firstName), company: str(c.company), source });
  }
  const suppressed = new Set((await db.emailSuppression.findMany({ where: { email: { in: [...rows.keys()] } }, select: { email: true } })).map((s) => s.email));
  const fresh = [...rows.values()].filter((r) => !suppressed.has(r.email));
  const { count } = await db.emailContact.createMany({ data: fresh, skipDuplicates: true });
  return NextResponse.json({ added: count, alreadyKnown: fresh.length - count, suppressed: suppressed.size, invalid });
}
