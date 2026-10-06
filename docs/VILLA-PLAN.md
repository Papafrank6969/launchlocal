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
2. **Editor** (after Frank's example videos): Remotion composition renders
   `SocialPost` specs to 1080×1920 MP4 in a scheduled GitHub Action (Vercel
   functions can't run Chromium+ffmpeg renders), uploads to Vercel Blob.
3. **Poster**: publishes rendered posts to Instagram (needs
   `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`), then TikTok per Frank's call.
   Posts go out with no human step, per Frank. Kill switch: the brother's
   enabled toggle on `/villa`.
