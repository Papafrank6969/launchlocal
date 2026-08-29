export type FollowUpLead = {
  name: string;
};

// Short and low-pressure on purpose — this is a bump, not a re-pitch. The
// original message already made the case; repeating it reads as spammy.
const FOLLOW_UP_OPENERS = [
  (l: FollowUpLead) => `Hey! Just following up on my last message to ${l.name} — no worries if you're swamped, wanted to make sure it didn't get buried.`,
  () => `Hi again! Bumping this in case it got lost in your DMs.`,
  (l: FollowUpLead) => `Hey, following up here for ${l.name} — totally fine if now isn't the right time, just wanted to check in.`,
];

const CLOSER = "Let me know if you'd like to see a mockup, or if now just isn't the right time — happy either way!";

// Once a draft exists, the follow-up can point straight at it instead of
// re-offering to build one.
const PREVIEW_CLOSER = (url: string) =>
  `The free sample I put together is still here if you want to take a look: ${url}. No pressure either way!`;

export function generateFollowUpMessage(
  lead: FollowUpLead,
  variant: number,
  opts: { previewUrl?: string | null } = {},
): string {
  const opener = FOLLOW_UP_OPENERS[variant % FOLLOW_UP_OPENERS.length](lead);
  const closer = opts.previewUrl ? PREVIEW_CLOSER(opts.previewUrl) : CLOSER;
  return `${opener} ${closer}`;
}

export const FOLLOW_UP_VARIANT_COUNT = 3;
