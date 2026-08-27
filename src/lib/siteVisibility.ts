/**
 * A site drafted from a lead is a sales pitch until that lead closes. It's
 * published so the operator can send "here's your site" as a working link, but
 * it stays out of search engines until the deal is WON — at which point it
 * becomes a real, indexed site for a real client.
 */
export function isUnclaimedPitchSite(
  leadId: string | null | undefined,
  leadOutreachStatus: string | null | undefined
): boolean {
  return Boolean(leadId) && leadOutreachStatus !== "WON";
}
