import { db } from "../db";
import { budgetFromEnv, startOfDayET } from "../agentBudget";
import type { ApprovalKind } from "../agentTypes";
import type { ScoutInput } from "./scout";
import type { RushChairInput } from "./rushChair";
import type { FollowUpInput } from "./followUp";
import type { BuilderLead } from "./builder";
import type { TreasurerInput } from "./treasurer";
import { HUNTER_RETRY_DAYS, type HunterDeps } from "./handleHunter";
import { lookupInstagramHandle } from "../instagramLookup";
import type { CreativeDirectorInput } from "./creativeDirector";
import type { PosterDeps } from "./poster";
import { GOAL, goalLine, type BossInput } from "./boss";
import { LEAGUES, type GamblerDeps, type Market } from "./gambler";
import { TARGET_CATEGORIES } from "../leadTargets";
import { CHAT_HISTORY, type ChatDeps, type ChatMessage } from "../agentChat";
import { sendTelegram, TELEGRAM_CHAT_STATE } from "../telegram";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { BUSINESS, type Inbound, type MailerDeps } from "./mailer";

// The only DB access brothers have. Reads only, except Handle Hunter's handle
// write and attempt log (plan §9) and Creative Director's SocialPost insert. Everything else writes through ctx.propose().

const SITES = { select: { id: true, slug: true, status: true } } as const;
// Outreach and follow-ups only go to the target niches (Frank dropped the old barber/salon leads, 2026-10-09).
const TARGETED = { in: TARGET_CATEGORIES };
const previewBase = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

async function pendingLeadIds(kind: ApprovalKind): Promise<Set<string>> {
  const rows = await db.approval.findMany({ where: { kind, state: "PENDING", leadId: { not: null } }, select: { leadId: true } });
  return new Set(rows.map((r) => r.leadId!));
}

async function filedNoteToday(agentId: string, now: Date): Promise<boolean> {
  return (await db.approval.count({ where: { agentId, kind: "NOTE", createdAt: { gte: startOfDayET(now) } } })) > 0;
}

export async function loadScoutInput(now = new Date()): Promise<ScoutInput> {
  const leads = await db.lead.findMany({
    where: { outreachStatus: "NEW", websiteStatus: { not: "HAS_SITE" }, category: TARGETED },
    include: { sites: SITES },
  });
  return {
    filedToday: await filedNoteToday("scout", now),
    leads: leads.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };
}

export async function loadRushChairInput(): Promise<RushChairInput> {
  // Same query as /api/leads/outreach-queue.
  const [leads, drafted] = await Promise.all([
    db.lead.findMany({
      where: { outreachStatus: "NEW", websiteStatus: { not: "HAS_SITE" }, NOT: { instagramHandle: null }, category: TARGETED },
      include: { sites: SITES },
    }),
    pendingLeadIds("DM_DRAFT"),
  ]);
  return {
    pendingDrafts: drafted.size,
    previewBase: previewBase(),
    leads: leads.filter((l) => !drafted.has(l.id)).map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };
}

export async function loadFollowUpInput(now = new Date()): Promise<FollowUpInput> {
  // Same query as /api/leads/follow-up-queue.
  const [leads, drafted] = await Promise.all([
    db.lead.findMany({
      where: { outreachStatus: "CONTACTED", NOT: { instagramHandle: null }, followUpAt: { not: null, lte: now }, category: TARGETED },
      include: { sites: SITES },
    }),
    pendingLeadIds("FOLLOW_UP_DRAFT"),
  ]);
  return {
    now,
    pendingDrafts: drafted.size,
    previewBase: previewBase(),
    leads: leads.filter((l) => !drafted.has(l.id)).map((l) => ({ ...l, followUpAt: l.followUpAt?.toISOString() ?? null })),
  };
}

export async function loadBuilderInput(): Promise<{ leads: BuilderLead[] }> {
  const [leads, proposed] = await Promise.all([
    db.lead.findMany({ where: { outreachStatus: "RESPONDED", sites: { none: {} } }, orderBy: { createdAt: "asc" } }),
    pendingLeadIds("SITE_DRAFT"),
  ]);
  return { leads: leads.filter((l) => !proposed.has(l.id)) };
}

export async function loadTreasurerInput(now = new Date()): Promise<TreasurerInput> {
  const today = startOfDayET(now);
  const yesterday = startOfDayET(new Date(today.getTime() - 1));
  const range = { gte: yesterday, lt: today };
  const [runs, events, pending, filedToday] = await Promise.all([
    db.agentRun.findMany({ where: { startedAt: range }, select: { agentId: true, outcome: true, costMicros: true } }),
    db.event.findMany({ where: { createdAt: range }, select: { type: true } }),
    db.approval.groupBy({ by: ["kind"], where: { state: "PENDING" }, _count: true }),
    filedNoteToday("treasurer", now),
  ]);
  return {
    dayLabel: yesterday.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }),
    filedToday,
    budgetMicros: budgetFromEnv(process.env.AGENT_DAILY_BUDGET_MICROS),
    runs,
    events,
    pending: pending.map((p) => ({ kind: p.kind, count: p._count })),
  };
}

const LOOKUP_KIND = "instagram_lookup";

export async function loadHandleHunterDeps(now = new Date()): Promise<HunterDeps> {
  const since = new Date(now.getTime() - HUNTER_RETRY_DAYS * 24 * 60 * 60 * 1000);
  const [leads, tried, doneToday] = await Promise.all([
    db.lead.findMany({
      where: { outreachStatus: "NEW", websiteStatus: { not: "HAS_SITE" }, instagramHandle: null, category: TARGETED },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, city: true },
    }),
    db.agentTask.findMany({ where: { kind: LOOKUP_KIND, createdAt: { gte: since } }, select: { leadId: true } }),
    db.agentTask.count({ where: { kind: LOOKUP_KIND, createdAt: { gte: startOfDayET(now) } } }),
  ]);
  const triedIds = new Set(tried.map((t) => t.leadId));
  return {
    leads: leads.filter((l) => !triedIds.has(l.id)),
    doneToday,
    lookup: lookupInstagramHandle,
    // Only fills an empty handle: never overwrites one Frank typed in.
    saveHandle: async (leadId, handle) => {
      await db.lead.updateMany({ where: { id: leadId, instagramHandle: null }, data: { instagramHandle: handle } });
    },
    recordAttempt: async (leadId, found) => {
      await db.agentTask.create({
        data: { agentId: "handle-hunter", kind: LOOKUP_KIND, leadId, status: found ? "DONE" : "FAILED", doneAt: new Date() },
      });
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

export async function loadCreativeDirectorInput(now = new Date()): Promise<CreativeDirectorInput> {
  const dayStart = startOfDayET(now);
  const recent = await db.socialPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 14,
    select: { audience: true, pillar: true, hook: true, createdAt: true },
  });
  return {
    draftedToday: recent.some((p) => p.createdAt >= dayStart),
    dayIndex: Math.round(dayStart.getTime() / 86_400_000),
    recent,
    save: async ({ audience, pillar, spec }) => {
      await db.socialPost.create({ data: { audience, pillar, hook: spec.hook, caption: spec.caption, spec } });
    },
  };
}

export async function loadPosterDeps(): Promise<PosterDeps> {
  const next = await db.socialPost.findFirst({
    where: { status: "RENDERED", videoUrl: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, caption: true, spec: true, videoUrl: true },
  });
  return {
    apiKey: process.env.ZERNIO_API_KEY,
    instagramAccountId: process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID,
    tiktokAccountId: process.env.ZERNIO_TIKTOK_ACCOUNT_ID,
    next: next && {
      id: next.id,
      caption: next.caption,
      hashtags: (next.spec as { hashtags?: string[] }).hashtags ?? [],
      videoUrl: next.videoUrl!,
    },
    fetch,
    markPosted: async (id) => {
      await db.socialPost.updateMany({ where: { id, status: "RENDERED" }, data: { status: "POSTED", postedAt: new Date(), error: null } });
    },
    markFailed: async (id, error) => {
      await db.socialPost.updateMany({ where: { id, status: "RENDERED" }, data: { status: "FAILED", error } });
    },
  };
}

const BOSS_STATE = "boss";

export async function loadBossInput(now = new Date()): Promise<BossInput> {
  const dayStart = startOfDayET(now);
  const [agents, lastRuns, pending, posts, spent, state, lastNote, firstPost] = await Promise.all([
    db.agent.findMany({ where: { id: { not: "boss" } }, select: { id: true, enabled: true }, orderBy: { id: "asc" } }),
    db.agentRun.findMany({
      where: { agentId: { not: "boss" }, trigger: { not: "CHAT" }, finishedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      distinct: ["agentId"],
      select: { agentId: true, outcome: true, summary: true, error: true },
    }),
    // Notes aren't blockers, and counting them made his own notes change what he sees.
    db.approval.groupBy({ by: ["kind"], where: { state: "PENDING", kind: { not: "NOTE" } }, _count: true, orderBy: { kind: "asc" } }),
    db.socialPost.groupBy({ by: ["status"], where: { createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } }, _count: true, orderBy: { status: "asc" } }),
    db.agentRun.aggregate({ _sum: { costMicros: true }, where: { startedAt: { gte: dayStart } } }),
    db.cronState.findUnique({ where: { id: BOSS_STATE } }),
    db.approval.findFirst({ where: { agentId: "boss" }, orderBy: { createdAt: "desc" }, select: { body: true } }),
    db.socialPost.findFirst({ where: { status: "POSTED" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  // Goal numbers count whole ET days only, so they don't change his snapshot every time a DM is marked sent.
  const yesterday = startOfDayET(new Date(dayStart.getTime() - 1));
  const [won, dmsYesterday, dmsLast7] = await Promise.all([
    db.event.findMany({ where: { type: "LEAD_WON", createdAt: { gte: GOAL.start } }, distinct: ["leadId"], select: { leadId: true } }),
    db.event.count({ where: { type: "LEAD_CONTACTED", createdAt: { gte: yesterday, lt: dayStart } } }),
    db.event.count({ where: { type: "LEAD_CONTACTED", createdAt: { gte: new Date(dayStart.getTime() - 7 * 86_400_000), lt: dayStart } } }),
  ]);
  const budget = budgetFromEnv(process.env.AGENT_DAILY_BUDGET_MICROS);
  const runOf = (id: string) => lastRuns.find((r) => r.agentId === id);
  // No timestamps or spend amounts: the snapshot only changes when something happens.
  const snapshot = [
    `Day (ET): ${dayStart.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "numeric", day: "numeric", year: "numeric" })}`,
    goalLine(won.length, dmsYesterday, dmsLast7, dayStart),
    `Budget: ${(spent._sum.costMicros ?? 0) >= budget * 0.8 ? "80%+ used today" : "fine"}`,
    "Brothers:",
    ...agents.map((a) => {
      const r = runOf(a.id);
      return `- ${a.id} (${a.enabled ? "on" : "off"}): ${r ? `${r.outcome} ${r.summary ?? ""}${r.error ? ` error: ${r.error}` : ""}` : "never ran"}`;
    }),
    `Waiting on Frank: ${pending.map((p) => `${p._count} ${p.kind}`).join(", ") || "nothing"}`,
    `Villa posts, last 7 days: ${posts.map((p) => `${p._count} ${p.status}`).join(", ") || "none"}${firstPost ? ` (first ever post ${firstPost.createdAt.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })})` : ""}`,
  ].join("\n");
  return {
    snapshot,
    lastSnapshot: state?.lastRunNote ?? null,
    lastNote: lastNote?.body ?? null,
    brotherIds: agents.map((a) => a.id),
    saveSnapshot: async (text) => {
      await db.cronState.upsert({
        where: { id: BOSS_STATE },
        create: { id: BOSS_STATE, lastRunAt: now, lastRunNote: text },
        update: { lastRunAt: now, lastRunNote: text },
      });
    },
    disable: async (id) => {
      await db.agent.update({ where: { id }, data: { enabled: false } });
    },
    notify: (text) => pushToFrank(`From the Boss:\n${text}`),
  };
}

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

async function kalshi(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${KALSHI}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Kalshi ${path.split("?")[0]}: HTTP ${res.status}`);
  return res.json();
}

type KalshiMarket = { ticker: string; event_ticker: string; yes_sub_title: string; yes_bid_dollars: string; yes_ask_dollars: string; expected_expiration_time: string; status: string; result: string };

export async function loadGamblerDeps(now = new Date()): Promise<GamblerDeps> {
  const [due, graded, filedToday] = await Promise.all([
    db.betPick.findMany({ where: { result: null, gameAt: { lte: now } }, select: { id: true, ticker: true } }),
    db.betPick.findMany({ where: { result: { not: null } }, select: { price: true, result: true, lean: true } }),
    filedNoteToday("gambler", now),
  ]);
  const etHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(now));
  return {
    now,
    etHour,
    filedToday,
    due,
    graded: graded.map((g) => ({ price: g.price, result: g.result!, lean: g.lean })),
    markets: async () => {
      const pages = await Promise.all(Object.keys(LEAGUES).map((s) => kalshi(`/markets?series_ticker=${s}&status=open&limit=1000`)));
      return pages.flatMap((p) =>
        (p.markets as KalshiMarket[]).map(
          (m): Market => ({
            ticker: m.ticker,
            event: m.event_ticker,
            team: m.yes_sub_title,
            bid: Number(m.yes_bid_dollars),
            ask: Number(m.yes_ask_dollars),
            gameAt: new Date(m.expected_expiration_time),
          }),
        ),
      );
    },
    settlement: async (ticker) => {
      const m = (await kalshi(`/markets/${encodeURIComponent(ticker)}`)).market as KalshiMarket;
      if (m.status !== "finalized" && m.status !== "settled") return null;
      return m.result === "yes" || m.result === "no" ? m.result : "void";
    },
    news: braveNews,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    grade: async (id, result) => {
      await db.betPick.update({ where: { id }, data: { result, gradedAt: new Date() } });
    },
    save: async (picks) => {
      await db.betPick.createMany({ data: picks });
    },
    notify: (text) => pushToFrank(`From the Gambler:\n${text}`),
  };
}

const stripTags = (t: string) => t.replace(/<[^>]+>/g, "").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** Top 3 news results from the past day. The key stays in a header. */
async function braveNews(query: string): Promise<string[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query)}&count=3&freshness=pd`, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { results?: { title?: string; description?: string; age?: string }[] };
    return (body.results ?? []).slice(0, 3).map((r) => stripTags(`${r.title ?? ""}: ${r.description ?? ""}${r.age ? ` (${r.age})` : ""}`).slice(0, 300));
  } catch {
    return [];
  }
}

/** Chat history and context, shared by the /house chat tab and the Boss's Telegram. */
export const chatStore: Pick<ChatDeps, "loadContext" | "saveMessages"> = {
  loadContext: async (agentId) => {
    const [runs, drafts, history, house] = await Promise.all([
      db.agentRun.findMany({
        where: { agentId, trigger: { not: "CHAT" } },
        orderBy: { startedAt: "desc" },
        take: 5,
        select: { outcome: true, summary: true },
      }),
      db.approval.findMany({ where: { agentId, state: "PENDING" }, select: { title: true } }),
      db.agentMessage.findMany({
        where: { agentId },
        orderBy: { createdAt: "desc" },
        take: CHAT_HISTORY,
        select: { role: true, content: true },
      }),
      agentId === "boss" ? loadBossInput().then((b) => b.snapshot) : undefined,
    ]);
    return { runs, drafts: drafts.map((d) => d.title), history: history.reverse() as ChatMessage[], house };
  },
  saveMessages: async (agentId, user, reply) => {
    const now = Date.now();
    await db.agentMessage.createMany({
      data: [
        { agentId, role: "user", content: user, createdAt: new Date(now) },
        { agentId, role: "assistant", content: reply, createdAt: new Date(now + 1) },
      ],
    });
  },
};

/** Sends to Frank's Telegram; a no-op until the bot is set up. */
async function pushToFrank(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = token ? await telegramChatId() : null;
  if (token && chatId) await sendTelegram(token, chatId, text);
}

/** Frank's Telegram chat id, claimed once by /api/telegram/setup; null until then. */
export async function telegramChatId(): Promise<string | null> {
  return (await db.cronState.findUnique({ where: { id: TELEGRAM_CHAT_STATE } }))?.lastRunNote ?? null;
}

export async function saveTelegramChatId(chatId: string): Promise<void> {
  await db.cronState.upsert({
    where: { id: TELEGRAM_CHAT_STATE },
    create: { id: TELEGRAM_CHAT_STATE, lastRunAt: new Date(), lastRunNote: chatId },
    update: { lastRunAt: new Date(), lastRunNote: chatId },
  });
}

const INBOX_LOOKBACK_MS = 2 * 86_400_000;

/** The Mailer's Gmail (SMTP + read-only IMAP) and email tables. Needs SMTP_PASSWORD (a Gmail app password). */
export async function loadMailerDeps(now = new Date()): Promise<MailerDeps> {
  const auth = { user: BUSINESS.from, pass: process.env.SMTP_PASSWORD ?? "" };
  const [suppressed, contacts, sentToday, first] = await Promise.all([
    db.emailSuppression.findMany({ select: { email: true } }),
    db.emailContact.findMany({ where: { status: "active" }, orderBy: { createdAt: "asc" }, include: { sends: { select: { step: true, sentAt: true, messageId: true } } } }),
    db.emailSend.count({ where: { sentAt: { gte: startOfDayET(now) } } }),
    db.emailSend.findFirst({ orderBy: { sentAt: "asc" }, select: { sentAt: true } }),
  ]);
  const blocked = new Set(suppressed.map((s) => s.email));
  const et = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const smtp = nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, secure: false, auth });

  return {
    now,
    etHour: Number(et.hour),
    etMinute: Number(et.minute),
    etWeekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(et.weekday),
    contacts: contacts.filter((c) => !blocked.has(c.email)),
    sentToday,
    firstSendAt: first?.sentAt ?? null,
    inbox: async () => {
      // Read-only (EXAMINE): never touches Frank's read/unread state.
      const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth, logger: false });
      await client.connect();
      const lock = await client.getMailboxLock("INBOX", { readOnly: true });
      try {
        const heads: { uid: number; key: string }[] = [];
        for await (const m of client.fetch({ since: new Date(now.getTime() - INBOX_LOOKBACK_MS) }, { uid: true, envelope: true })) {
          heads.push({ uid: m.uid, key: m.envelope?.messageId ?? `${m.envelope?.from?.[0]?.address}|${String(m.envelope?.date)}|${m.envelope?.subject}` });
        }
        const done = new Set((await db.emailInbound.findMany({ where: { messageId: { in: heads.map((h) => h.key) } }, select: { messageId: true } })).map((r) => r.messageId));
        const out: Inbound[] = [];
        for (const h of heads.filter((h) => !done.has(h.key))) {
          const m = await client.fetchOne(String(h.uid), { source: true }, { uid: true });
          if (!m || !m.source) continue;
          const p = await simpleParser(m.source);
          const hdr = (k: string) => String(p.headers.get(k) ?? "").toLowerCase();
          out.push({
            messageId: h.key,
            from: p.from?.text ?? "",
            subject: p.subject ?? "",
            text: p.text ?? "",
            autoReply: (hdr("auto-submitted") !== "" && hdr("auto-submitted") !== "no") || !!p.headers.get("x-autoreply") || !!p.headers.get("x-autorespond") || ["auto_reply", "bulk", "junk"].includes(hdr("precedence")),
          });
        }
        return out;
      } finally {
        lock.release();
        await client.logout();
      }
    },
    applyInbound: async (msg, kind, email) => {
      const contact = email ? await db.emailContact.findUnique({ where: { email } }) : null;
      if (email && !contact) return null;
      if (contact && (kind === "unsubscribe" || kind === "bounce")) {
        await db.emailContact.update({ where: { id: contact.id }, data: { status: kind === "bounce" ? "bounced" : "unsubscribed" } });
        await db.emailSuppression.upsert({ where: { email: contact.email }, create: { email: contact.email, reason: kind === "bounce" ? "bounced" : "unsubscribed" }, update: {} });
      }
      // Don't downgrade an unsubscribe or bounce to a reply.
      if (contact && kind === "reply") await db.emailContact.updateMany({ where: { id: contact.id, status: { in: ["active", "completed"] } }, data: { status: "replied" } });
      await db.emailInbound.createMany({ data: [{ messageId: msg.messageId, contactId: contact?.id ?? null, kind: contact ? kind : "unmatched", subject: msg.subject.slice(0, 200) }], skipDuplicates: true });
      return contact && { email: contact.email, company: contact.company };
    },
    send: async (m) => {
      try {
        await smtp.sendMail({
          from: { name: BUSINESS.fromName, address: BUSINESS.from },
          to: m.to,
          subject: m.subject,
          text: m.text,
          messageId: m.messageId,
          ...(m.inReplyTo && { inReplyTo: m.inReplyTo, references: m.inReplyTo }),
          // Native unsubscribe button. No List-Unsubscribe-Post: one-click needs an https URI.
          headers: { "List-Unsubscribe": `<mailto:${BUSINESS.from}?subject=unsubscribe>` },
        });
        return "sent";
      } catch (err) {
        // A 5xx on the recipient is a hard bounce; anything else (auth, network) fails the run so the Boss sees it.
        const e = err as { code?: string; responseCode?: number };
        if (e.code === "EENVELOPE" && e.responseCode && e.responseCode >= 500) return "refused";
        throw err;
      }
    },
    recordSend: async (contactId, step, subject, messageId, last) => {
      await db.emailSend.create({ data: { contactId, step, subject, messageId } });
      if (last) await db.emailContact.update({ where: { id: contactId }, data: { status: "completed" } });
    },
    bounce: async (contactId, email) => {
      await db.emailContact.update({ where: { id: contactId }, data: { status: "bounced" } });
      await db.emailSuppression.upsert({ where: { email }, create: { email, reason: "bounced" }, update: {} });
    },
    notify: (text) => pushToFrank(text),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
