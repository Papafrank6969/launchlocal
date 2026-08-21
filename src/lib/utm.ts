export function withUtm(url: string, opts: { enabled: boolean; slug: string }): string {
  if (!opts.enabled) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "launchlocal");
    u.searchParams.set("utm_medium", "referral");
    u.searchParams.set("utm_campaign", opts.slug);
    return u.toString();
  } catch {
    return url;
  }
}
