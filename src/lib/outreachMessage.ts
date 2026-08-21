export type OutreachLead = {
  name: string;
  category: string;
  city: string;
  websiteStatus: "NONE" | "POOR" | "HAS_SITE";
};

const NO_SITE_OPENERS = [
  (l: OutreachLead) => `Hey! I was looking for a ${l.category} in ${l.city} and came across ${l.name} — couldn't find a website for you online, though.`,
  (l: OutreachLead) => `Hi ${l.name}! Big fan of local ${l.category}s in ${l.city} — noticed you don't have a website yet.`,
  (l: OutreachLead) => `Hey there — I help ${l.category}s in ${l.city} get found online, and noticed ${l.name} doesn't have a site up yet.`,
];

const POOR_SITE_OPENERS = [
  (l: OutreachLead) => `Hey! I was looking for a ${l.category} in ${l.city} and found ${l.name} — but your current site is really just a social page, which makes it harder for new customers to find you on Google.`,
  (l: OutreachLead) => `Hi ${l.name}! Noticed your online presence right now is mostly just social media — a real site would make you look a lot more established.`,
  (l: OutreachLead) => `Hey there — I help local ${l.category}s in ${l.city} get a proper web presence, and saw ${l.name}'s "website" is really just a Facebook/Instagram page right now.`,
];

const CLOSERS = [
  "I build real, professional sites for small businesses fast and affordably — want me to send over a free mockup, no obligation?",
  "I put together quick, professional sites for local businesses — happy to whip up a free sample for you if you're interested, no pressure.",
  "I design sites specifically for local businesses like yours — would you want to see a quick free mockup?",
];

export function generateOutreachMessage(lead: OutreachLead, variant: number): string {
  const openers = lead.websiteStatus === "NONE" ? NO_SITE_OPENERS : POOR_SITE_OPENERS;
  const opener = openers[variant % openers.length](lead);
  const closer = CLOSERS[variant % CLOSERS.length];
  return `${opener} ${closer}`;
}

export const OUTREACH_VARIANT_COUNT = 3;
