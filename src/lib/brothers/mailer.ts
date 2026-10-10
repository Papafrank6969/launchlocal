import type { BrotherContext } from "../agentTypes";

// The Mailer (2026-10-10): Frank's cold email sequence, ported from
// ~/projects/cold-email-pipeline so it runs on the 15-minute ticks instead of his
// PC. No Claude: fixed copy, the same offer as the DMs (a free sample site).
// Every tick he reads the inbox first (any reply stops the sequence; unsubscribes
// and bounces are suppressed for good), then sends a slice of what's due,
// weekdays 9-5 ET, ramping 20 -> 100 a day from the first send.

export const BUSINESS = {
  name: "Scale Strategies",
  address: "3 Granada Pl, Massapequa, NY 11758",
  from: "frank@tryscalestrategies.com",
  fromName: "Frank",
};
export const WINDOW = { startHour: 9, endHour: 17 }; // ET, Monday-Friday
export const RAMP = { start: 20, max: 100, days: 14 };
/** Sends per 15-minute tick; ticks themselves are the spacing between emails. */
export const MAX_PER_TICK = 4;

export const STEPS = [
  {
    step: 1,
    delayDays: 0,
    subject: "Quick question about {{company}}",
    body: `Hi {{first_name}},

I came across {{company}} and couldn't find a real website for you, mostly just social pages.

I build simple websites for detailers and tattoo shops: your services and prices, a gallery of your work, your hours and a map, an FAQ, and a link to the booking app you already use. On your own domain, and you keep your Instagram.

I'd be happy to put together a free sample site for {{company}} so you can see exactly what it would look like. No cost to look and no obligation.

Want me to make one?

Frank
Scale Strategies`,
  },
  {
    step: 2,
    delayDays: 3,
    subject: "Re: Quick question about {{company}}",
    body: `Hi {{first_name}},

Following up on my note below in case it got buried.

The idea is simple: when someone looks up {{company}}, they land on one link with your prices, your work, your hours and how to book, instead of having to DM you to ask.

The offer stands. I'll build a free sample site for {{company}} and send you the link. Just reply "yes."

Frank
Scale Strategies`,
  },
  {
    step: 3,
    delayDays: 7,
    subject: "Re: Quick question about {{company}}",
    body: `Hi {{first_name}},

Last note from me, I don't want to clutter your inbox.

If you'd ever like to see a sample website for {{company}}, reply "sample" and I'll build one and send you the link. Free, and yours to look at whether or not we work together.

Either way, all the best with {{company}}.

Frank
Scale Strategies`,
  },
];

export type Contact = { id: string; email: string; firstName: string; company: string; sends: { step: number; sentAt: Date; messageId: string }[] };
export type Outgoing = { to: string; subject: string; text: string; messageId: string; inReplyTo: string | null };
export type Inbound = { messageId: string; from: string; subject: string; text: string; autoReply: boolean };
export type Kind = "reply" | "unsubscribe" | "bounce" | "auto_reply";

export type MailerDeps = {
  now: Date;
  /** ET hour and weekday (0 = Sunday). */
  etHour: number;
  etMinute: number;
  etWeekday: number;
  /** Active contacts (not replied/unsubscribed/bounced/completed, not suppressed), with their sends. */
  contacts: Contact[];
  sentToday: number;
  firstSendAt: Date | null;
  /** Inbox from the last two days, minus messages already handled. */
  inbox(): Promise<Inbound[]>;
  /** Records the outcome; returns the contact it matched, if any. */
  applyInbound(msg: Inbound, kind: Kind, matchEmail: string | null): Promise<{ email: string; company: string } | null>;
  send(msg: Outgoing): Promise<"sent" | "refused">;
  recordSend(contactId: string, step: number, subject: string, messageId: string, last: boolean): Promise<void>;
  bounce(contactId: string, email: string): Promise<void>;
  notify(text: string): Promise<void>;
  sleep(ms: number): Promise<void>;
};

const BOUNCE_FROM = /(mailer-daemon|postmaster|mail delivery)/i;
const BOUNCE_SUBJECT = /(undeliver|delivery status notification|failure notice|returned mail|delivery failed)/i;
const UNSUB = /\bunsubscribe\b|\bopt.?out\b|\bremove me\b|\bstop emailing\b|\btake me off\b/i;
const AUTO_SUBJECT = /(out of (the )?office|automatic reply|auto.?reply|away from|on vacation)/i;
// Where the quoted original starts. Our footer says "unsubscribe", so a reply quoting it must not read as an opt-out.
const QUOTE_START = /^(On .{0,200}wrote:\s*$|-{2,}\s*Original Message\s*-{2,}|From:\s.+|_{10,}|--\s*$)/im;
export const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/** Only what the person wrote, above the quoted original. */
export function stripQuoted(body: string): string {
  const m = QUOTE_START.exec(body);
  return (m ? body.slice(0, m.index) : body)
    .split("\n")
    .filter((l) => !l.trimStart().startsWith(">"))
    .join("\n");
}

export function classify(msg: Inbound): Kind {
  if (BOUNCE_FROM.test(msg.from) || BOUNCE_SUBJECT.test(msg.subject)) return "bounce";
  if (msg.autoReply || AUTO_SUBJECT.test(msg.subject)) return "auto_reply";
  if (UNSUB.test(msg.subject) || UNSUB.test(stripQuoted(msg.text).slice(0, 2000))) return "unsubscribe";
  return "reply";
}

export function render(tpl: string, c: Pick<Contact, "firstName" | "company">): string {
  return tpl.replaceAll("{{first_name}}", c.firstName || "there").replaceAll("{{company}}", c.company || "your business");
}

/** CAN-SPAM: who's sending, a real address, and a working opt-out, on every email. */
export function footer(email: string): string {
  return `\n\n--\n${BUSINESS.name}\n${BUSINESS.address}\nDon't want these emails? Reply to this message with the word "unsubscribe" or write to ${BUSINESS.from} and we'll remove ${email} within 10 business days.`;
}

/** The next step each contact is due for now, in order, strictly one step at a time. */
export function dueSends(contacts: Contact[], now: Date): { contact: Contact; step: (typeof STEPS)[number] }[] {
  const out = [];
  for (const contact of contacts) {
    const done = [...contact.sends].sort((a, b) => a.step - b.step);
    const next = STEPS[done.length];
    if (!next || done.some((s, i) => s.step !== i + 1)) continue;
    const last = done.at(-1);
    if (last && now.getTime() - last.sentAt.getTime() < next.delayDays * 86_400_000) continue;
    out.push({ contact, step: next });
  }
  return out;
}

/** Warm-up: 20 a day on day one, straight line to 100 by day 14. */
export function todaysCap(firstSendAt: Date | null, now: Date): number {
  if (!firstSendAt) return RAMP.start;
  const days = Math.floor((now.getTime() - firstSendAt.getTime()) / 86_400_000);
  return days >= RAMP.days ? RAMP.max : Math.floor(RAMP.start + ((RAMP.max - RAMP.start) * days) / RAMP.days);
}

/** How many to send this tick: today's remainder spread over the ticks left in the window. */
export function sliceForTick(remaining: number, etHour: number, etMinute: number): number {
  const ticksLeft = Math.max(1, (WINDOW.endHour - etHour) * 4 - Math.floor(etMinute / 15));
  return Math.max(0, Math.min(MAX_PER_TICK, Math.ceil(remaining / ticksLeft)));
}

export async function mailerJob(d: MailerDeps, ctx: BrotherContext): Promise<string> {
  // Inbox first, so a reply that came in since last tick stops the next email.
  const tally: Record<Kind | "unmatched", number> = { reply: 0, unsubscribe: 0, bounce: 0, auto_reply: 0, unmatched: 0 };
  for (const msg of await d.inbox()) {
    const kind = classify(msg);
    // A bounce names the failed recipient in its body; anything else is from the contact.
    const candidates = kind === "bounce" ? [...msg.text.matchAll(EMAIL_RE)].map((m) => m[0]) : [msg.from.match(EMAIL_RE)?.[0] ?? ""];
    let matched: { email: string; company: string } | null = null;
    for (const c of candidates) if (c && !matched) matched = await d.applyInbound(msg, kind, c.toLowerCase());
    if (!matched) {
      await d.applyInbound(msg, kind, null);
      tally.unmatched++;
      continue;
    }
    tally[kind]++;
    if (kind === "reply") await d.notify(`Email reply from ${matched.company || matched.email} (${matched.email}): "${msg.subject}"\n\n${stripQuoted(msg.text).trim().slice(0, 600)}`);
  }
  const inboxLine = (["reply", "unsubscribe", "bounce"] as const).filter((k) => tally[k]).map((k) => `${tally[k]} ${k}`).join(", ");

  const inWindow = d.etWeekday >= 1 && d.etWeekday <= 5 && d.etHour >= WINDOW.startHour && d.etHour < WINDOW.endHour;
  const due = dueSends(d.contacts, d.now);
  if (!inWindow || due.length === 0) return [inboxLine, inWindow ? "nothing due" : `${due.length} due, outside send window`].filter(Boolean).join("; ");

  const remaining = todaysCap(d.firstSendAt, d.now) - d.sentToday;
  const batch = due.slice(0, sliceForTick(remaining, d.etHour, d.etMinute));
  if (batch.length === 0) return [inboxLine, "daily cap reached"].filter(Boolean).join("; ");

  await ctx.setNow(`sending ${batch.length} emails`);
  let sent = 0;
  let bounced = 0;
  for (const [i, { contact, step }] of batch.entries()) {
    if (i > 0) await d.sleep(5_000 + Math.random() * 15_000);
    const subject = render(step.subject, contact);
    const messageId = `<${crypto.randomUUID()}@${BUSINESS.from.split("@")[1]}>`;
    const prev = contact.sends.find((s) => s.step === step.step - 1);
    const result = await d.send({ to: contact.email, subject, text: render(step.body, contact) + footer(contact.email), messageId, inReplyTo: prev?.messageId ?? null });
    if (result === "refused") {
      await d.bounce(contact.id, contact.email);
      bounced++;
      continue;
    }
    await d.recordSend(contact.id, step.step, subject, messageId, step.step === STEPS.length);
    sent++;
  }
  return [inboxLine, `sent ${sent}${bounced ? `, ${bounced} refused` : ""} (${due.length - sent - bounced} still due)`].filter(Boolean).join("; ");
}
