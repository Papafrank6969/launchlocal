# Design process

LaunchLocal has two surfaces with different design rules:

1. **Generated sites** (`/s/[slug]`) — one bespoke look per business, drawn from
   the curated systems in `src/lib/designSystems.ts`. Governed by
   [`SITE-QUALITY-CHECKLIST.md`](SITE-QUALITY-CHECKLIST.md).
2. **The operator app** (`/leads`, `/builder`, `/pipeline`, `/stats`) — one
   consistent internal tool. Tailwind utilities, `blue-600` primary, `slate-*`
   neutrals, `emerald-600` for publish/positive actions.

Both use the **`ui-ux-pro-max`** Claude Code skill as their design reference DB.

## What the skill is, and isn't, for us

It is a **searchable reference database** — 190+ product palettes, 74 font
pairings, 119 UX guidelines, accessibility outcomes, spacing/shadow scales.
Query it before making a visual or interaction decision.

It is **not a code generator or a source of truth** here. Its `--design-system`
command auto-picks a whole look (pattern, palette, GSAP motion, landing
structure) from a short phrase. That output regularly proposes things LaunchLocal
does not ship: scroll-triggered storytelling, parallax, "animate everything,"
funnel/demo landing patterns, raw hex palettes. Treat `--design-system` output as
**a menu of candidates to evaluate**, never as instructions.

**Precedence when they conflict:** `SITE-QUALITY-CHECKLIST.md` > this file > the
operator-app conventions above > skill output. If the skill says animate on
scroll and the checklist says don't, the checklist wins.

## Running a query

The script lives in the plugin cache, not this repo. Resolve `python` →
`python3` → `py -3` as needed.

```bash
SEARCH="$(ls -d ~/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/*/.claude/skills/ui-ux-pro-max/scripts/search.py | tail -1)"
python "$SEARCH" "<2-5 term query>" --domain <ux|color|typography|style|landing|icons|chart>
python "$SEARCH" "<product type> <industry> <keywords>" --design-system --variance <1-10> --motion <1-10> --density <1-10>
```

Keep queries to one intent and 2–5 terms. Retry once narrower if empty; if still
empty, say so and fall back to the checklist — never invent a result.

## Where it plugs into the process

### 1. Adding or revising a curated design system (`src/lib/designSystems.ts`)

Before hand-building a `DesignSystem` entry:

```bash
python "$SEARCH" "<niche> <mood keywords>" --design-system --variance 2 --motion 1
python "$SEARCH" "<niche> <mood>" --domain color        # palette candidates
python "$SEARCH" "<mood> <serif|sans> pairing" --domain typography
```

Then:

- Pull only the **palette hues and the font pairing** from the results. Ignore
  the pattern, motion, effects, and landing sections — LaunchLocal's three hero
  styles and site chrome are fixed.
- Hand-build the 4-role color system (`colorPrimary` / `colorAccent` /
  `colorNeutralDark` / `colorNeutralLight`). The skill's palettes are 16-role and
  often light-on-light; you are adapting, not copying.
- **WCAG-gate it.** Every system must pass `src/lib/contrast.ts`'s AA check.
  `npm test` runs `src/lib/designSystems.test.ts` + `contrast.test.ts` against
  the whole list — a new entry with a failing pair breaks the suite. Never
  eyeball hex codes.
- Fill `categories` with the exact lowercase strings a lead's category would
  produce (`deterministicDesignSystem` matches exact-before-substring).
- New Google Fonts must be real families with the weights named in `fontHeading`
  / `fontBody` — `googleFontsHref` builds the URL from them.

The curated list **is** the generated-site design system. There is no persisted
MASTER for `/s/[slug]` because every site is different; the skill informs which
curated entry to add or sharpen, and `src/lib/generateDesign.ts` (AI, forced
tool-use) or `deterministicDesignSystem` picks per business at build time.

### 2. Touching site templates (`src/lib/templates.tsx`, `src/app/s/[slug]/**`, `src/components/site/**`)

Query the specific UX concern first, then apply within the checklist:

```bash
python "$SEARCH" "hero hierarchy primary CTA above fold" --domain ux
python "$SEARCH" "price list menu scannable" --domain ux
python "$SEARCH" "testimonial card credibility attribution" --domain ux
python "$SEARCH" "orphan heading line balance" --domain ux
python "$SEARCH" "reduced motion respect" --domain ux
```

The skill's `--stack html-tailwind` results are usable here (Tailwind + RSC).
`--stack nextjs` for App Router / streaming questions.

### 3. Operator app UI (`src/app/(app)/**`, non-`site` components)

```bash
python "$SEARCH" "internal admin dashboard data table" --domain ux --density 7
python "$SEARCH" "form density label helper inline validation" --domain ux
python "$SEARCH" "empty state first run" --domain ux
python "$SEARCH" "focus ring keyboard nav" --domain ux
```

Keep the existing palette and `.input` component. Use the skill for density,
form behaviour, table/list ergonomics, empty states, and accessibility — not for
recoloring the app.

## Standing reference (reconciled for this repo)

Pulled from the skill and merged with existing conventions. When these disagree
with a specific checklist item, the checklist wins.

**Spacing** — Tailwind's default scale. Site sections: `py-16`–`py-24`. Operator
app: `px-6 py-12` page frame, `gap-4`/`gap-8` between blocks.

**Motion** — 150–300ms on hover/focus/state transitions; never 0ms. No
scroll-triggered reveals on generated sites (checklist). `prefers-reduced-motion`
is already handled by the site chrome components — keep it that way.

**Focus** — visible focus ring on every interactive element. Operator `.input`
uses a 3px primary-tinted ring; never remove focus outlines.

**Icons** — Lucide only (already the dependency). Never emoji as icons.

**Forms** — visible `<label>` (not placeholder-only), validate on blur, error
text next to the field, a focusable error summary for failed submits, and an
explicit loading→success/error state. The public contact form already does this;
match it in the operator app.

**Contrast** — 4.5:1 body text both themes. Generated sites are gated by
`src/lib/contrast.ts`; hold the operator app to the same bar by eye + a checker
when picking any non-Tailwind color.

## Audit log

### 2026-08-27 — full design-system library audit

All 12 systems in `designSystems.ts` checked against the skill's `--domain color`
and `--domain typography` for their niche.

- **Palettes and font pairings kept as-is.** The hand-curated pairings are as
  strong as or stronger than the skill's generic suggestions, and two of the
  skill's picks would have *broken* the checklist:
  - `studio-beauty` — skill proposed `#EC4899` (hot pink) primary + `#8B5CF6`
    (purple) accent + `#FDF2F8` background. That is exactly the "purple/pink
    sell.app tell" the checklist forbids. Current near-black + muted rose on warm
    cream is the deliberate opposite and stays.
  - `crafted-artisan` — skill proposed the `Amatic SC` handwriting display font.
    Script/handwriting display fonts are a checklist "never." Zilla Slab stays.
- **`studio-beauty` accent nudged** `#B8828A → #AE7680` — the old value was
  2.91:1 on the light neutral, below the 3:1 UI bar the test now enforces.
- **Routing gaps closed.** ~90 additional `categories` strings added across the
  12 systems so trades and services that were falling through to the hashed
  fallback (roofers, barbers, chiropractors, movers, tattoo shops, yoga studios,
  photographers, cocktail bars, …) now land on a system whose look fits. No new
  systems — the 12 cover the aesthetic space. `designSystems.test.ts` locks a
  representative sample of the new routes.

Takeaway: the curated list is doing its job. Use the skill to *check* a system
and to route new niches, not to recolor what already passes.

### 2026-08-27 — operator app pass

Ran the skill's `--domain ux` guidelines against `/leads`, `/pipeline`,
`/stats`, `/builder`. `--design-system` auto-matched the app as a
"Marketplace/Directory" with a green palette — ignored per the precedence rule.
Existing palette (`blue-600` / `slate-*` / `emerald-600`), tables (already
`overflow-x-auto` + `min-w`), empty states, `ConfirmModal`, and `FormStatus`
auto-clear all held up. Fixed:

- `.input` and a new `.select-compact` component class now carry a visible
  focus ring (`focus:ring-2 ring-blue-500/40`) — the app had no focus styling
  on most fields. Standing reference in this doc updated to match.
- Emoji-as-icon removed: `⭐` → Lucide `Star`, `🔄` → Lucide `RefreshCw`,
  `×` → Lucide `X`. `AppHeader`'s hand-rolled hamburger SVG → Lucide
  `Menu`/`X` to match the site header's icon set.
- Lead Finder search + card fields: `<label htmlFor>` / input `id` wired up
  (were unassociated), fields moved onto `.input`, and the search row
  top-aligns instead of bottom-aligning against the tall multi-select.
- `ConfirmModal` danger button `bg-red-600` → `bg-red-700` (the 600 shade is
  ~3.9:1 on white, under the 4.5 bar) and got `aria-labelledby`.

Still open (bigger, not in this pass): the Category / Trades pickers are
`<select multiple>` — hard to discover and easy to lose selections; a
checkbox group would be the fix. The operator app is also effectively
light-only despite a theme toggle in the header.

### 2026-08-27 — richer generated-site template

A landing-page design brief (2-col hero, trust bar, image service cards,
about-with-image, CTA banner) was applied as a **content model**, not a
literal template — the 12 curated design systems, their palettes, font
pairings, and three hero layouts stay. `SitePreview` was refactored from
three duplicated branches into `hero + SiteSections`, and the sections from
the brief were added once. Photos come from an **opt-in** "Pull photos from
Google" editor button (not auto on every draft), stored with attribution and
meant to be replaced before the site goes to the client.

The literal parts of the brief that were *not* adopted, and why: fixed
`#F8FAFC` backgrounds (each system has its own WCAG-checked neutral), a
mandatory serif headline (several systems are sans+sans), `py-20` section
spacing (kept the tighter `py-14 sm:py-20` from the F10 fix),
`border-slate-200` dividers (sites use the palette-tinted `site-border`).
