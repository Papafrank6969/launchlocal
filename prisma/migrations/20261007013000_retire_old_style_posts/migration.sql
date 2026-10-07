-- One-off (2026-10-06): unposted villa posts were written and rendered in the
-- old style (no music, LaunchLocal end card, older voice). Drop them so the
-- Poster can't publish one; Creative Director writes a fresh post. POSTED rows stay.
DELETE FROM "SocialPost" WHERE "status" IN ('DRAFTED', 'RENDERED');
