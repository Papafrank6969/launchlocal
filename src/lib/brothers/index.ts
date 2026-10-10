import type { BrotherDefinition } from "../agentTypes";
import { scoutJob } from "./scout";
import { rushChairJob } from "./rushChair";
import { followUpJob } from "./followUp";
import { builderJob } from "./builder";
import { treasurerJob } from "./treasurer";
import { handleHunterJob } from "./handleHunter";
import { creativeDirectorJob } from "./creativeDirector";
import { posterJob } from "./poster";
import { bossJob } from "./boss";
import { gamblerJob } from "./gambler";
import { mailerJob } from "./mailer";
import { loadBossInput, loadBuilderInput, loadCreativeDirectorInput, loadFollowUpInput, loadGamblerDeps, loadHandleHunterDeps, loadMailerDeps, loadPosterDeps, loadRushChairInput, loadScoutInput, loadTreasurerInput } from "./brotherData";

// Every registered brother, in cron order (docs/FRAT-HOUSE-BROTHERS-PLAN.md).
// The cron upserts each into the Agent table, so a new brother shows up on the
// house just by being added here. Jobs are pure; the loaders do the DB reads.
export const BROTHERS: BrotherDefinition[] = [
  {
    // First, so Rush Chair can draft for the handles it finds the same day.
    id: "handle-hunter",
    name: "Handle Hunter",
    role: "Finds Instagram handles for new leads",
    run: async (ctx) => handleHunterJob(await loadHandleHunterDeps(), ctx),
  },
  {
    id: "scout",
    name: "Scout",
    role: "Picks the day's best untouched leads and says why",
    run: async (ctx) => scoutJob(await loadScoutInput(), ctx),
  },
  {
    id: "rush-chair",
    name: "Rush Chair",
    role: "Drafts first Instagram DMs for new leads",
    run: async (ctx) => rushChairJob(await loadRushChairInput(), ctx),
  },
  {
    id: "follow-up",
    name: "Follow-up",
    role: "Drafts follow-up DMs for leads that are due",
    run: async (ctx) => followUpJob(await loadFollowUpInput(), ctx),
  },
  {
    id: "builder",
    name: "Builder",
    role: "Proposes draft sites for leads who replied",
    run: async (ctx) => builderJob(await loadBuilderInput(), ctx),
  },
  {
    id: "treasurer",
    name: "Treasurer",
    role: "Writes yesterday's numbers: spend, runs, funnel, what's waiting",
    run: async (ctx) => treasurerJob(await loadTreasurerInput(), ctx),
  },
  {
    // Paper sports picks for Frank to place by hand on Robinhood (no API there).
    id: "gambler",
    name: "Gambler",
    role: "Picks sports bets from Kalshi prices and keeps his own record",
    model: "claude-sonnet-5-5",
    run: async (ctx) => gamblerJob(await loadGamblerDeps(), ctx),
  },
  // The Villa (docs/VILLA-PLAN.md): social media brothers, shown on /villa.
  {
    id: "creative-director",
    name: "Creative Director",
    role: "Writes one TikTok/Reels post a day for LaunchLocal",
    house: "villa",
    model: "claude-sonnet-5-5", // Haiku kept inventing features; posts are public
    run: async (ctx) => creativeDirectorJob(await loadCreativeDirectorInput(), ctx),
  },
  {
    // Renders need Chromium + ffmpeg, which Vercel functions can't run. The
    // render-posts GitHub Action does the work and logs runs via
    // /api/cron/villa/render-report. "Run now" here just says where he works.
    id: "editor",
    name: "Editor",
    role: "Turns each post into a 9:16 video (Remotion)",
    house: "villa",
    cron: false,
    run: async () => "renders run in GitHub Actions (render-posts workflow, started by the agents cron)",
  },
  {
    // Runs right after the Editor's render (render-report), so a post goes out
    // minutes after it's written. No human step. Kill switch: his toggle on /villa.
    id: "poster",
    name: "Poster",
    role: "Posts one video a day to Instagram and TikTok",
    house: "villa",
    cron: false,
    run: async (ctx) => posterJob(await loadPosterDeps(), ctx),
  },
  {
    // Cold email from Frank's Gmail (ported from ~/projects/cold-email-pipeline). No Claude.
    id: "mailer",
    name: "Mailer",
    role: "Sends Frank's 3-step cold email sequence and stops it the moment anyone replies",
    run: async (ctx) => (process.env.SMTP_PASSWORD ? mailerJob(await loadMailerDeps(), ctx) : "not set up: SMTP_PASSWORD missing"),
  },
  {
    // Last on every tick so he sees what everyone just did. In charge of both
    // houses, so he lives on /house. Thinks only when something changed.
    id: "boss",
    name: "Big Boss",
    role: "Watches both houses, tells Frank what needs him, benches brothers who misbehave",
    model: "claude-sonnet-5-5",
    run: async (ctx) => bossJob(await loadBossInput(), ctx),
  },
];

export const inVilla = (id: string) => BROTHERS.some((b) => b.id === id && b.house === "villa");

export function findBrother(id: string): BrotherDefinition | undefined {
  return BROTHERS.find((b) => b.id === id);
}
