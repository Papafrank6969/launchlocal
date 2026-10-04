"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { HouseResponse } from "@/app/api/house/route";
import { formatMicros } from "@/lib/houseStats";
import { AgentPanel } from "./AgentPanel";

const HouseScene = dynamic(() => import("./HouseScene"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-slate-300">Loading the house…</p>,
});

const POLL_MS = 15_000;

const STATUS_DOT: Record<string, string> = {
  IDLE: "bg-amber-400",
  RUNNING: "bg-emerald-500 motion-safe:animate-pulse",
  ERROR: "bg-red-600",
  OFF: "bg-slate-400",
};

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

export function HouseView() {
  const [data, setData] = useState<HouseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sceneFailed, setSceneFailed] = useState(false);
  const reducedMotion = useReducedMotion();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/house", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Poll every 15s while the tab is visible.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") {
        refresh();
        timer = setInterval(refresh, POLL_MS);
      }
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [refresh]);

  const stats = data?.stats;
  const spentPct = stats ? Math.min(100, Math.round((stats.spentTodayMicros / stats.budgetMicros) * 100)) : 0;
  const agents = data?.agents ?? [];
  const selectedAgent = agents.find((a) => a.id === selected) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Frat House</h1>
      <p className="mt-1 text-slate-600">Who&apos;s working, what it costs, and what&apos;s waiting for you.</p>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load the house ({error}). Retrying every 15s.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Leads in backlog" value={stats?.backlog ?? "–"} />
        <Stat label="DMs sent (7d)" value={stats?.dmsSent7d ?? "–"} />
        <Stat label="Replies (7d)" value={stats?.replies7d ?? "–"} />
        <Stat label="Sites published" value={stats?.sitesPublished ?? "–"} />
        <Stat label="Drafts waiting" value={stats?.draftsWaiting ?? "–"} />
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Spend today</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {stats ? formatMicros(stats.spentTodayMicros) : "–"}
            <span className="text-sm font-normal text-slate-500"> / {stats ? formatMicros(stats.budgetMicros) : "–"}</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Spend vs daily budget"
            aria-valuenow={spentPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={`h-full rounded-full ${spentPct >= 90 ? "bg-red-600" : "bg-blue-600"}`} style={{ width: `${spentPct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div aria-hidden="true" className="relative h-[60vh] min-h-80 overflow-hidden rounded-xl bg-[#0b1020]">
          {sceneFailed ? (
            <p className="p-6 text-sm text-slate-300">The 3D house couldn&apos;t load. Use the brother list.</p>
          ) : (
            <HouseScene agents={agents} reducedMotion={reducedMotion} onSelect={setSelected} onFail={() => setSceneFailed(true)} />
          )}
        </div>

        <nav aria-label="Brothers" className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="px-2 pb-2 text-sm font-semibold text-slate-900">Brothers</h2>
          {data && agents.length === 0 && <p className="px-2 text-sm text-slate-500">No brothers yet.</p>}
          <ul className="space-y-1">
            {agents.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[a.status]}`} aria-hidden="true" />
                  <span className="flex-1">
                    <span className="font-medium text-slate-900">{a.name}</span>
                    <span className="block text-xs text-slate-500">
                      {a.status.toLowerCase()}
                      {a.status === "RUNNING" && a.currentTask ? ` · ${a.currentTask}` : ""}
                    </span>
                  </span>
                  {a.pending > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {a.pending}
                      <span className="sr-only"> drafts waiting</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <AgentPanel agent={selectedAgent} onClose={() => setSelected(null)} onChanged={refresh} />
    </div>
  );
}
