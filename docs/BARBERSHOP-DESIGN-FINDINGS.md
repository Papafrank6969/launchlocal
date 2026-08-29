# Barbershop design check — findings

_Piece B of `docs/LOOKUP-LEAK-AND-BARBER-CHECK-PLAN.md`, done by the boss._
_Superseded agent-3's "couldn't run the tooling" stub._

## What was checked

Ran the app, searched real Massapequa NY barbershops (live Google Places data),
drafted a site from **South Shore Barber Shop** (`/s/south-shore-barber-shop`,
4.9★ / 186 reviews), and looked at the published draft under three design
systems. Screenshots are on the PR.

## Verdict: `technical-precision` reads wrong for a barbershop

The `docs/DESIGN-PROCESS.md` am-entry guessed the navy primary was "CTA/accent
only." It isn't. On a photo-less draft — which is exactly what a prospect sees
in the outreach DM — `#22548C` is the **entire hero band**. Flat mid-navy reads
municipal: police department, insurance office, HVAC. Not barbershop.

- The Oswald condensed headline is genuinely good for a barbershop — that part
  of the system works.
- The navy is the "template mill, not bespoke" tell (`SITE-QUALITY-CHECKLIST.md`
  core bar).
- The per-business colour variant picker can't rescue it: variants move the
  accent hue + paper tint only, never `colorPrimary`. Every variant of a
  barbershop still gets the navy hero.

## Comparison

| System | Hero | Type | CTA | Reads as |
| --- | --- | --- | --- | --- |
| `technical-precision` (current) | flat navy band | Oswald condensed | off-white pill | municipal / contractor |
| **`crafted-artisan`** (recommended) | warm cream, centered | Zilla Slab | rust-brown pill | **traditional barbershop** — leather, pomade, straight razor |
| `minimal-luxury` | cream, centered | Cormorant Garamond | black pill | upscale salon / spa — delicate serif is off for a neighbourhood barber |

## Recommendation: re-route `barber` / `barbershop` → `crafted-artisan`

Warm brown (`#7A3A1D`) on cream (`#FAF3E9`) with a slab serif is the barbershop
vernacular, and it holds in both the draft state (no photo) and the delivered
state. It's an existing system that already passes the full contrast sweep
(base + 6 variants) — no new design work, no new system (respects the standing
"12 cover the space" call).

Trade-off: `crafted-artisan`'s Zilla Slab leans craft-bakery more than
condensed-barbershop, and its `mood`/`categories` were goods-only. Colour beats
font here; the mood string is widened to name barbershops. Not worth a new
"Oswald + warm + dark" system.

**This PR makes the change** — routing + mood strings in `designSystems.ts`,
`designSystems.test.ts` assertions, and the `DESIGN-PROCESS.md` audit entry.
`serviceSuggestions.ts` / `faqSuggestions.ts` barber entries are content, not
design — unchanged.

Closes the "revisit if operators report it reads too contractor" note.
