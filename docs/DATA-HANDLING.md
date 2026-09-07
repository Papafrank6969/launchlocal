# Data handling

What personal data LaunchLocal holds, where it lives, how long it's kept, and
what to do if it leaks. Written to satisfy the **NY SHIELD Act** requirement for
reasonable safeguards + a breach-response plan for private information of New
York residents. Companion to `docs/BRAND-AND-COMPLIANCE-STANDARDS.md` §2.

Not legal advice.

## What we hold

| Data | Where it comes from | Where it's stored | Retention |
| --- | --- | --- | --- |
| **Contact form submissions** (name, email, message) from generated client sites | The visitor types it | `ContactSubmission` table, Neon Postgres (US) | Up to 24 months, then deleted (enforced by the `refresh-places` cron once C-D lands; manual until then) |
| **Prospect business data** (name, address, phone, website, rating) | Google Places API | `Lead` table, Neon Postgres | Refreshed or purged on a rolling 30-day cycle (C-D) |
| **Draft/published site content** | Operator-entered + the business's own Google photos/reviews | `Site` + related tables, Neon Postgres; images in Vercel Blob (public) | Life of the site; Google-derived fields on a 30-day refresh |
| **Server request logs** (IP, user agent, timestamp) | Automatic, all requests | Vercel platform logs | Short platform-default retention, then rotated out |
| **Operator preferences** (theme) | The operator's / visitor's browser | `localStorage` on their device only | Until they clear it; never sent to us |

No payment data. No passwords (the app has no accounts). No special-category
data. No advertising or analytics identifiers.

## Safeguards in place

- All traffic over HTTPS (Vercel-managed TLS).
- Database access is via a single connection string held only in Vercel
  environment variables and the operator's local `.env` (gitignored). Not in the
  repo, not in client code.
- The Blob store is public **by design** (it serves site images); nothing
  sensitive is written there, only site photos.
- `CRON_SECRET` gates the cron endpoints so they can't be triggered by anyone.
- Contact-form input is validated client and server side; submissions are
  scoped to a single site.
- Dependencies: `npm audit` reviewed at each release; Dependabot/GitHub alerts
  on the repo.

## Known gaps (tracked)

- Automated 24-month purge of `ContactSubmission` ships with C-D
  (`docs/PLACES-RETENTION-PLAN.md`); until then it's a manual delete.
- No formal access log of who queried the DB (single operator, low risk).
- Preview deploys share the production `DATABASE_URL` (see `docs/BOARD.md`
  "Known footgun").

## If data leaks (breach response)

1. **Contain.** Rotate the exposed credential immediately in Vercel (DB URL,
   `CRON_SECRET`, API keys as relevant). Redeploy.
2. **Assess.** What was exposed, whose data, how many NY residents. The only
   data that could constitute "private information" under the SHIELD Act here is
   a contact submission (name + email). No SSNs, financial account numbers, or
   biometric data are stored, so most incidents will not meet the Act's
   notification threshold, but confirm per incident.
3. **Notify** if the threshold is met: affected individuals "in the most
   expedient time possible and without unreasonable delay," plus the NY Attorney
   General, Department of State, and State Police (the SHIELD Act tri-agency
   notice). Use the AG's template.
4. **Record.** Write up what happened, the cause, and the fix in a dated note
   under `docs/`. Feed the fix back into "Safeguards in place" above.

Contact for any data question: **Frank.Sulawa@icloud.com**.
