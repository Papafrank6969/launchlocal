@AGENTS.md

When editing `src/lib/templates.tsx`, anything under `src/app/s/[slug]/**`, or
`src/components/site/**`, read `docs/SITE-QUALITY-CHECKLIST.md` first — it's the
standing bar for what a LaunchLocal-built site is and isn't allowed to look like.

## Testing

`npm test` runs the Vitest suite (`src/lib/*.test.ts`). See `TESTING.md` for
conventions. 100% coverage is the goal — tests make vibe coding safe:

- New function → write a corresponding test.
- Bug fix → write a regression test that fails before, passes after.
- New conditional (if/else, switch) → test both paths.
- Never commit code that makes existing tests fail.
