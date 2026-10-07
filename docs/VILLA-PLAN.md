# The Villa: social media house

Frank, 2026-10-05: "I want a social media manager, which means they post content
on TikTok and Instagram, in a separate house. Social media guys live here."
Model: Bali villa with Roman influence (Downloads zip, Collada). Posting should be
fully automatic. Videos are "made with just code" (Remotion style); Frank is
collecting example videos.

Content is **LaunchLocal promo**: posts that sell websites to lash / nail / brow
techs and barbers.

## Hard rules (from BRAND-AND-COMPLIANCE-STANDARDS.md, applied to posts)

- **No real lead businesses in posts.** Lead names, photos, reviews and sample
  sites come from Google Places (30-day cache limit, no republishing) and the
  business never agreed to be in an ad. Only a WON client who says yes, or a
  fictional demo business that's clearly a demo.
- No fake metrics, testimonials, results or client counts. No "I made $10k".
- No AI-generated photos or video of people, places or products. Code-made
  motion graphics, text and real screenshots of demo sites only.
- No em dashes, no emoji spam (code-enforced, same `scrubDraft`).
- Captions say what LaunchLocal actually does. No guarantees ("more bookings").

## Platforms (checked 2026-10-05)

- **Instagram:** "Instagram API with Instagram Login" publishes images, carousels
  and Reels to a professional (Business/Creator) account, no Facebook Page.
  Standard Access is enough for an account that has a role on the app, so
  posting to Frank's own account needs no app review. Reels: create container
  (`media_type=REELS`, public `video_url`) → poll until `FINISHED` → publish.
- **TikTok:** Content Posting API. Unaudited apps post **private only**
  (`SELF_ONLY`) until TikTok's audit passes (2–4 weeks, demo video required,
  rejections common). Decision for Frank: apply for the audit, or use an
  already-audited posting service.

## Phases

1. **Villa + Creative Director** (this PR). `/villa` page with the villa
   model; brothers get a `house` field; first villa brother, **Creative
   Director**, writes one post spec a day (hook, on-screen beats, caption,
   hashtags) into a new `SocialPost` table. No keys needed.
2. **Editor** (PR #23). `video/` is a separate Remotion project (own
   package.json, kept out of the Next build). `Post` composition: 1080x1920,
   30fps, ~16-18s: hook words pop in, each beat slides in while a code-drawn
   phone mockup lights up the matching site section (`focusFor`), last beat is
   the CTA with "Book now" lit, then a LaunchLocal end card. Text stays out of
   the TikTok/Reels UI zones. Silent for now (API posts can't attach trending
   sounds; licensed music is a later call).
   `.github/workflows/render-posts.yml` runs daily 17:40 UTC (after the agents
   cron) + manual: GET `/api/cron/villa/render-queue` → render → POST
   `/api/cron/villa/upload-url` for a 15-minute signed Blob PUT URL (the app
   signs with its Vercel OIDC credentials, so the Action holds no Blob token)
   → PUT the MP4 → POST `/api/cron/villa/render-report`, which marks posts
   RENDERED/FAILED and logs the run as the Editor's. All three routes need
   `Bearer CRON_SECRET` and fail closed. GitHub secrets: `APP_URL`,
   `CRON_SECRET`. Remotion is free for individuals/companies of up to 3 people.
3. **Poster**: publishes rendered posts to Instagram (needs
   `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`), then TikTok per Frank's call.
   Posts go out with no human step, per Frank. Kill switch: the brother's
   enabled toggle on `/villa`.
   **Built (PR #24):** `src/lib/brothers/poster.ts`, last in the 17:30 UTC
   agents cron. Frank chose a posting service for both platforms (2026-10-06):
   Zernio (formerly Late), audited for TikTok so posts go public, first 2
   accounts free. One video a day, oldest RENDERED post (the previous
   evening's render), one `POST /v1/posts` to every connected account.
   Zernio publishes async; per-platform failures show in its dashboard.
   Unset env = no-op.

**Same-day posting (2026-10-06):** the render Action runs at 17:40 UTC (was
18:30) and `render-report` runs the Poster right after a successful render, so
the post of the day goes out ~10 min after Creative Director writes it (was
~23 h). The Poster is `cron: false`; his /villa toggle still stops him, and
"Run now" still posts the oldest RENDERED video.
