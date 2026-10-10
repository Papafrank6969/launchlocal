import type { BrotherContext } from "../agentTypes";

// The Email Finder (2026-10-10): reads the weak sites some target-niche leads
// already have (Wix, Linktree, Google Sites...) for an email they publish, saves
// it on the lead and enrolls it in the Mailer. No Claude, no search API: one or
// two plain page fetches per lead. Social pages (Instagram, Facebook) sit behind
// logins and their terms, so he never fetches those.

/** Per ET day, and per tick (fetches run inside the shared cron window). */
export const FINDER_PER_DAY = 40;
export const FINDER_PER_TICK = 5;
export const FINDER_RETRY_DAYS = 30;

const SOCIAL_HOSTS = ["instagram.com", "facebook.com", "fb.com", "tiktok.com", "twitter.com", "x.com", "yelp.com", "goo.gl"];
// Google itself and Maps, but not sites.google.com: that's a site builder these leads use.
const GOOGLE_PAGES = ["google.com", "maps.google.com"];
// Addresses that show up in page code but aren't the business: placeholders, platform and tracking mail.
const JUNK = /(@(example|domain|email|yourdomain|sentry|wixpress|sentry-next\.wixpress|squarespace|godaddy|linktr)\.|^(noreply|no-reply|donotreply|privacy|abuse)@|\.(png|jpe?g|gif|webp|svg)$)/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export type FinderLead = { id: string; name: string; url: string };
export type FinderDeps = {
  leads: FinderLead[]; // target niche, has a non-social site, no email, not tried in 30 days; oldest first
  doneToday: number;
  /** Page HTML, or null on any failure (timeout, 404, not HTML). */
  fetchPage(url: string): Promise<string | null>;
  /** Saves the email on the lead and enrolls it in the Mailer (skipping suppressed). */
  save(lead: FinderLead, email: string): Promise<void>;
  recordAttempt(leadId: string, found: boolean): Promise<void>;
};

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

/** Social and map pages, plus anything unparseable: never fetched. */
export function isSocial(url: string): boolean {
  const host = hostOf(url);
  return !host || GOOGLE_PAGES.includes(host) || SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** The business's own address from a page: a mailto link first, then one on the site's own domain, then any. */
export function pickEmail(html: string, siteUrl: string): string | null {
  const text = html.replace(/&#0*64;|&#x0*40;|\[at\]|\(at\)/gi, "@");
  const clean = (list: string[]) =>
    list.map((e) => e.toLowerCase().replace(/^\.+|\.+$/g, "")).filter((e) => e.match(EMAIL)?.[0] === e && !JUNK.test(e));
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const mailtos = clean([...text.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => decode(m[1])));
  const rest = clean(text.match(EMAIL) ?? []);
  const host = hostOf(siteUrl);
  return mailtos[0] ?? rest.find((e) => host && e.endsWith(`@${host}`)) ?? rest[0] ?? null;
}

export async function emailFinderJob(deps: FinderDeps, ctx: BrotherContext): Promise<string> {
  const left = Math.min(FINDER_PER_TICK, Math.max(0, FINDER_PER_DAY - deps.doneToday));
  if (left === 0) return `done for today (${FINDER_PER_DAY} sites)`;
  const leads = deps.leads.slice(0, left);
  if (leads.length === 0) return "no lead sites to check";

  let found = 0;
  for (const lead of leads) {
    await ctx.setNow(`reading ${lead.name}'s site`);
    let email: string | null = null;
    const home = await deps.fetchPage(lead.url);
    if (home) email = pickEmail(home, lead.url);
    if (!email) {
      const contact = await deps.fetchPage(new URL("/contact", lead.url).toString());
      if (contact) email = pickEmail(contact, lead.url);
    }
    if (email) {
      await deps.save(lead, email);
      found++;
    }
    await deps.recordAttempt(lead.id, !!email);
  }
  return `checked ${leads.length} sites: ${found} email${found === 1 ? "" : "s"} found and enrolled`;
}
