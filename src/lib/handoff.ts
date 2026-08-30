export type HandoffStep = { key: string; label: string; help: string };

export const HANDOFF_STEPS: HandoffStep[] = [
  {
    key: "domain",
    label: "Domain registered / confirmed",
    help: "The client owns the domain, or you've registered it for them.",
  },
  {
    key: "dns",
    label: "DNS pointed at the host",
    help: "A/ALIAS or CNAME records updated so the domain resolves to the deployment.",
  },
  {
    key: "live-on-domain",
    label: "Loads on the custom domain over HTTPS",
    help: "Visit the real domain — valid cert, site renders.",
  },
  {
    key: "search-visible",
    label: "Search indexing confirmed",
    help: "The pitch-site noindex clears automatically on WON; confirm robots.txt and the sitemap now include this site.",
  },
  {
    key: "google-business",
    label: "Google Business Profile updated",
    help: "The website field on the client's Google listing points at the new domain.",
  },
  {
    key: "client-package-sent",
    label: "Handoff summary sent to client",
    help: "The client has the live URL, what's included, and how to request changes (use *Copy summary*).",
  },
  {
    key: "payment-arranged",
    label: "Payment / invoice arranged",
    help: "First invoice sent or payment collected.",
  },
];

export const HANDOFF_STEP_KEYS = HANDOFF_STEPS.map((s) => s.key) as readonly string[];

export function reconcileHandoffTasks(
  existingKeys: readonly string[],
  steps: HandoffStep[] = HANDOFF_STEPS
): { key: string; order: number }[] {
  const present = new Set(existingKeys);
  return steps
    .map((s, i) => ({ key: s.key, order: i }))
    .filter((row) => !present.has(row.key));
}

export type HandoffProgress = {
  total: number;
  done: number;
  pct: number;
  complete: boolean;
  nextStep: HandoffStep | null;
};

export function buildHandoffProgress(tasks: { key: string; done: boolean }[]): HandoffProgress {
  const doneByKey = new Map(tasks.map((t) => [t.key, t.done]));
  const total = HANDOFF_STEPS.length;
  const done = HANDOFF_STEPS.filter((s) => doneByKey.get(s.key) === true).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const nextStep = HANDOFF_STEPS.find((s) => doneByKey.get(s.key) !== true) ?? null;
  return { total, done, pct, complete: done === total, nextStep };
}

export type HandoffSummaryInput = {
  businessName: string;
  liveUrl: string;
  customDomain: string | null;
  pages: string[];
  contactEmail?: string | null;
};

export function handoffSummaryText(input: HandoffSummaryInput): string {
  const customDomain = input.customDomain?.trim() || null;
  const webAddress = customDomain ? `https://${customDomain}` : input.liveUrl;
  const emailLine = input.contactEmail?.trim()
    ? `\nQuestions: ${input.contactEmail.trim()}\n`
    : "";

  const sections = [
    "Your new website is live",
    "========================",
    "",
    `Business: ${input.businessName}`,
    `Web address: ${webAddress}`,
    ...(customDomain ? [`Preview link (always works): ${input.liveUrl}`, ""] : []),
    "What's included",
    ...input.pages.map((p) => `  - ${p}`),
    "",
    "Requesting changes",
    "Reply with what you'd like changed - copy, photos, hours, services.",
    "There's no login and nothing for you to manage; send the change to us",
    "and we'll make it.",
    ...(emailLine ? [emailLine.trim()] : []),
  ].join("\n");

  return `${sections}\n`;
}
