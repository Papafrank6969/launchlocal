# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast, trust
your instincts, and ship with confidence — without them, vibe coding is just yolo
coding. With tests, it's a superpower.

## Framework

[Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) +
jsdom. Config: `vitest.config.mts`.

## Running tests

```bash
npm test          # run once
npx vitest         # watch mode
```

## Test layers

- **Unit tests** — pure functions in `src/lib/*.test.ts`, next to the file they
  cover. This is where most of the app's real logic lives (design-system
  matching, contrast checking, hours parsing, slug generation, outreach status).
- **Integration tests** — not yet present. Would live under `src/app/**` next to
  API routes, using a test SQLite DB rather than mocking Prisma.
- **E2E / browser tests** — handled by `/qa` (gstack's browse tool) against a
  running dev server, not by this test suite. That's how the site builder,
  lead finder, and published multi-page sites get exercised end to end.

## Conventions

- One `<name>.test.ts` file per `<name>.ts` module, in the same directory.
- `describe` blocks group by exported function; `it` names read as a sentence
  ("returns false when there is no follow-up date").
- Assert real behavior and outputs, never `toBeDefined()`/`not.toThrow()` alone.
- Regression tests found by `/qa` carry a comment linking the issue and report.

## Test expectations

- When writing a new function, write a corresponding test.
- When fixing a bug, write a regression test that fails before the fix and
  passes after.
- When adding a conditional (if/else, switch), test both paths.
- Never commit code that makes existing tests fail.
