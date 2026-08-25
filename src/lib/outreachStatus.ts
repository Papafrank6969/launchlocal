export type OutreachStatus = "NEW" | "CONTACTED" | "RESPONDED" | "WON" | "LOST";

export const OUTREACH_STATUSES: OutreachStatus[] = ["NEW", "CONTACTED", "RESPONDED", "WON", "LOST"];

export const OUTREACH_LABEL: Record<OutreachStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  RESPONDED: "Responded",
  WON: "Won",
  LOST: "Lost",
};

export const OUTREACH_STYLE: Record<OutreachStatus, string> = {
  NEW: "bg-slate-100 text-slate-600",
  CONTACTED: "bg-blue-100 text-blue-700",
  RESPONDED: "bg-purple-100 text-purple-700",
  WON: "bg-emerald-100 text-emerald-700",
  LOST: "bg-slate-200 text-slate-500",
};

export function isOverdue(followUpAt: string | null): boolean {
  if (!followUpAt) return false;
  return new Date(followUpAt).getTime() < Date.now();
}
