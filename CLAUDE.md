@AGENTS.md

When editing `src/lib/templates.tsx`, anything under `src/app/s/[slug]/**`, or
`src/components/site/**`, read `docs/SITE-QUALITY-CHECKLIST.md` first — it's the
standing bar for what a LaunchLocal-built site is and isn't allowed to look like.

For any visual, layout, typography, color, or interaction decision — on the
generated sites, `src/lib/designSystems.ts`, or the operator app — read
`docs/DESIGN-PROCESS.md` first. It defines how the `ui-ux-pro-max` skill plugs
in as the design reference DB and the precedence when its output conflicts with
the checklist (the checklist wins).

## Testing

`npm test` runs the Vitest suite (`src/lib/*.test.ts`). See `TESTING.md` for
conventions. 100% coverage is the goal — tests make vibe coding safe:

- New function → write a corresponding test.
- Bug fix → write a regression test that fails before, passes after.
- New conditional (if/else, switch) → test both paths.
- Never commit code that makes existing tests fail.
