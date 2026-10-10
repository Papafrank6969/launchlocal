import { describe, expect, it } from "vitest";
import { classify, dueSends, footer, mailerJob, render, sliceForTick, stripQuoted, todaysCap, type Contact, type Inbound, type MailerDeps, type Outgoing } from "./mailer";
import { fakeCtx } from "./testCtx";

const now = new Date("2026-10-12T14:00:00Z"); // Monday 10:00 ET
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const contact = (id: string, sends: Contact["sends"] = []): Contact => ({ id, email: `${id}@shop.com`, firstName: "", company: "Shine Co", sends });
const msg = (over: Partial<Inbound> = {}): Inbound => ({ messageId: "<m1>", from: "Dana <a@shop.com>", subject: "Re: Quick question about Shine Co", text: "", autoReply: false, ...over });

describe("classify", () => {
  it("doesn't read a positive reply that quotes our footer as an unsubscribe", () => {
    const text = `Yes please, send the sample!\n\nOn Mon, Oct 12, 2026 at 10:00 AM Frank wrote:\n> Don't want these emails? Reply with the word "unsubscribe"`;
    expect(classify(msg({ text }))).toBe("reply");
    expect(stripQuoted("Sure\n-----Original Message-----\nunsubscribe")).toBe("Sure\n");
  });
  it("catches real unsubscribes, bounces and out-of-office", () => {
    expect(classify(msg({ text: "Please remove me from your list" }))).toBe("unsubscribe");
    expect(classify(msg({ subject: "Unsubscribe" }))).toBe("unsubscribe");
    expect(classify(msg({ from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>" }))).toBe("bounce");
    expect(classify(msg({ subject: "Automatic reply: Quick question" }))).toBe("auto_reply");
    expect(classify(msg({ autoReply: true, text: "unsubscribe" }))).toBe("auto_reply");
  });
});

describe("render and footer", () => {
  it("fills names with safe fallbacks and always carries the CAN-SPAM footer", () => {
    expect(render("Hi {{first_name}}, about {{company}}", { firstName: "", company: "" })).toBe("Hi there, about your business");
    const f = footer("a@shop.com");
    for (const s of ["Scale Strategies", "3 Granada Pl, Massapequa, NY 11758", "unsubscribe", "a@shop.com"]) expect(f).toContain(s);
  });
});

describe("dueSends", () => {
  it("sends step 1 now, follow-ups only after their delay, one step at a time", () => {
    const fresh = contact("a");
    const step1Today = contact("b", [{ step: 1, sentAt: daysAgo(1), messageId: "<1>" }]);
    const step1Old = contact("c", [{ step: 1, sentAt: daysAgo(3), messageId: "<1>" }]);
    const step2Recent = contact("d", [{ step: 1, sentAt: daysAgo(10), messageId: "<1>" }, { step: 2, sentAt: daysAgo(6), messageId: "<2>" }]);
    const step2Old = contact("e", [{ step: 1, sentAt: daysAgo(10), messageId: "<1>" }, { step: 2, sentAt: daysAgo(7), messageId: "<2>" }]);
    const due = dueSends([fresh, step1Today, step1Old, step2Recent, step2Old], now);
    expect(due.map((d) => [d.contact.id, d.step.step])).toEqual([["a", 1], ["c", 2], ["e", 3]]);
  });
});

describe("ramp and pacing", () => {
  it("ramps 20 -> 100 over 14 days from the first send", () => {
    expect(todaysCap(null, now)).toBe(20);
    expect(todaysCap(daysAgo(7), now)).toBe(60);
    expect(todaysCap(daysAgo(30), now)).toBe(100);
  });
  it("spreads the day's remainder over the ticks left, max 4 a tick", () => {
    expect(sliceForTick(20, 9, 0)).toBe(1); // 32 ticks left
    expect(sliceForTick(100, 9, 0)).toBe(4);
    expect(sliceForTick(5, 16, 45)).toBe(4); // last tick: as many as allowed
    expect(sliceForTick(0, 12, 0)).toBe(0);
  });
});

function deps(over: Partial<MailerDeps> = {}) {
  const sent: Outgoing[] = [];
  const recorded: [string, number, boolean][] = [];
  const applied: [string, string | null][] = [];
  const pushed: string[] = [];
  const bounced: string[] = [];
  const d: MailerDeps = {
    now,
    etHour: 10,
    etMinute: 0,
    etWeekday: 1,
    contacts: [],
    sentToday: 0,
    firstSendAt: null,
    inbox: async () => [],
    applyInbound: async (m, kind, email) => (applied.push([kind, email]), email === "a@shop.com" ? { email, company: "Shine Co" } : null),
    send: async (m) => (sent.push(m), "sent"),
    recordSend: async (id, step, _s, _m, last) => void recorded.push([id, step, last]),
    bounce: async (id) => void bounced.push(id),
    notify: async (t) => void pushed.push(t),
    sleep: async () => {},
    ...over,
  };
  return { d, sent, recorded, applied, pushed, bounced };
}

describe("mailerJob", () => {
  it("reads the inbox first and pings Frank's phone on a real reply", async () => {
    const { d, pushed, applied } = deps({ inbox: async () => [msg({ text: "Yes, make one!\n\nOn Mon Frank wrote:\n> unsubscribe" }), msg({ messageId: "<m2>", from: "news@x.com" })] });
    expect(await mailerJob(d, fakeCtx().ctx)).toBe("1 reply; nothing due");
    expect(applied).toEqual([["reply", "a@shop.com"], ["reply", "news@x.com"], ["reply", null]]);
    expect(pushed[0]).toContain('Email reply from Shine Co (a@shop.com): "Re: Quick question about Shine Co"');
    expect(pushed[0]).toContain("Yes, make one!");
    expect(pushed[0]).not.toContain("unsubscribe");
  });

  it("matches a bounce to the recipient named in its body", async () => {
    const bounce = msg({ from: "mailer-daemon@googlemail.com", subject: "Delivery Status Notification", text: "Address not found: x@y.com\nOriginal to a@shop.com" });
    const { d, applied, pushed } = deps({ inbox: async () => [bounce] });
    expect(await mailerJob(d, fakeCtx().ctx)).toBe("1 bounce; nothing due");
    expect(applied).toEqual([["bounce", "x@y.com"], ["bounce", "a@shop.com"]]);
    expect(pushed).toHaveLength(0);
  });

  it("only sends weekdays 9-5 ET", async () => {
    for (const over of [{ etWeekday: 6 }, { etWeekday: 0 }, { etHour: 8 }, { etHour: 17 }]) {
      const { d, sent } = deps({ contacts: [contact("a")], ...over });
      expect(await mailerJob(d, fakeCtx().ctx)).toBe("1 due, outside send window");
      expect(sent).toHaveLength(0);
    }
  });

  it("sends a tick's slice with footer, threading and a fresh Message-ID", async () => {
    const c = contact("c", [{ step: 1, sentAt: daysAgo(3), messageId: "<step1@tryscalestrategies.com>" }]);
    const { d, sent, recorded } = deps({ contacts: [c], etHour: 16, etMinute: 45 });
    expect(await mailerJob(d, fakeCtx().ctx)).toBe("sent 1 (0 still due)");
    expect(sent[0].to).toBe("c@shop.com");
    expect(sent[0].subject).toBe("Re: Quick question about Shine Co");
    expect(sent[0].text).toContain("Hi there,");
    expect(sent[0].text).toContain("3 Granada Pl");
    expect(sent[0].inReplyTo).toBe("<step1@tryscalestrategies.com>");
    expect(sent[0].messageId).toMatch(/^<[\w-]+@tryscalestrategies\.com>$/);
    expect(recorded).toEqual([["c", 2, false]]);
  });

  it("stops at the daily cap and suppresses a refused recipient", async () => {
    const capped = deps({ contacts: [contact("a")], sentToday: 20 });
    expect(await mailerJob(capped.d, fakeCtx().ctx)).toBe("daily cap reached");
    expect(capped.sent).toHaveLength(0);

    const refused = deps({ contacts: [contact("a")], etHour: 16, etMinute: 45, send: async () => "refused" });
    expect(await mailerJob(refused.d, fakeCtx().ctx)).toBe("sent 0, 1 refused (0 still due)");
    expect(refused.bounced).toEqual(["a"]);
    expect(refused.recorded).toHaveLength(0);
  });

  it("marks a contact completed on the last step", async () => {
    const c = contact("e", [{ step: 1, sentAt: daysAgo(10), messageId: "<1>" }, { step: 2, sentAt: daysAgo(7), messageId: "<2>" }]);
    const { d, recorded } = deps({ contacts: [c], etHour: 16, etMinute: 45 });
    await mailerJob(d, fakeCtx().ctx);
    expect(recorded).toEqual([["e", 3, true]]);
  });
});
