"use client";

import { OUTREACH_LABEL, OUTREACH_STATUSES, isOverdue, type OutreachStatus } from "@/lib/outreachStatus";

/** Parent owns persistence — onChange is expected to both update local state and PATCH the server. */
export function OutreachControls({
  leadId,
  outreachStatus,
  followUpAt,
  onChange,
}: {
  leadId: string;
  outreachStatus: OutreachStatus;
  followUpAt: string | null;
  onChange: (leadId: string, patch: { outreachStatus?: OutreachStatus; followUpAt?: string | null }) => void;
}) {
  function patch(body: { outreachStatus?: OutreachStatus; followUpAt?: string | null }) {
    onChange(leadId, body);
  }

  function followUpInDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    patch({ followUpAt: d.toISOString() });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        value={outreachStatus}
        onChange={(e) => patch({ outreachStatus: e.target.value as OutreachStatus })}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700"
      >
        {OUTREACH_STATUSES.map((s) => (
          <option key={s} value={s}>
            {OUTREACH_LABEL[s]}
          </option>
        ))}
      </select>

      {followUpAt ? (
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            isOverdue(followUpAt) ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          Follow up {new Date(followUpAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          <button
            type="button"
            onClick={() => patch({ followUpAt: null })}
            aria-label="Clear follow-up date"
            className="ml-1.5 text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </span>
      ) : (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => followUpInDays(3)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            +3d
          </button>
          <button
            type="button"
            onClick={() => followUpInDays(7)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            +7d
          </button>
        </div>
      )}
    </div>
  );
}
