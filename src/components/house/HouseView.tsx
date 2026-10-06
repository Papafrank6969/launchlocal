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
const VillaScene = dynamic(() => import("./VillaScene"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-slate-300">Loading the villa…</p>,
});

const POST_STATUS: Record<string, string> = {
  DRAFTED: "bg-slate-100 text-slate-700",
  RENDERED: "bg-blue-50 text-blue-700",
  POSTED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
};

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

export function HouseView({ house = "frat" }: { house?: "frat" | "villa" }) {
  const villa = house === "villa";
  const [data, setData] = useState<HouseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sceneFailed, setSceneFailed] = useState(false);
  const reducedMotion = useReducedMotion();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(villa ? "/api/house?house=villa" : "/api/house", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [villa]);

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
      <h1 className="text-2xl font-semibold text-slate-900">{villa ? "The Villa" : "Frat House"}</h1>
      <p className="mt-1 text-slate-600">
        {villa ? "The social media guys: what they wrote, rendered and posted." : "Who’s working, what it costs, and what’s waiting for you."}
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load the house ({error}). Retrying every 15s.
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {villa ? (
          <>
            <Stat label="Posts written (7d)" value={data ? Object.values(data.posts7d).reduce((a, b) => a + b, 0) : "–"} />
            <Stat label="Rendered (7d)" value={data ? (data.posts7d.RENDERED ?? 0) : "–"} />
            <Stat label="Posted (7d)" value={data ? (data.posts7d.POSTED ?? 0) : "–"} />
            <Stat label="Failed (7d)" value={data ? (data.posts7d.FAILED ?? 0) : "–"} />
            <Stat label="Guys in the villa" value={data ? agents.length : "–"} />
          </>
        ) : (
          <>
            <Stat label="Leads in backlog" value={stats?.backlog ?? "–"} />
            <Stat label="DMs sent (7d)" value={stats?.dmsSent7d ?? "–"} />
            <Stat label="Replies (7d)" value={stats?.replies7d ?? "–"} />
            <Stat label="Sites published" value={stats?.sitesPublished ?? "–"} />
            <Stat label="Drafts waiting" value={stats?.draftsWaiting ?? "–"} />
          </>
        )}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">Spend today{villa ? " (both houses)" : ""}</div>
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
          ) : villa ? (
            <VillaScene agents={agents} reducedMotion={reducedMotion} onSelect={setSelected} onFail={() => setSceneFailed(true)} />
          ) : (
            <HouseScene agents={agents} reducedMotion={reducedMotion} onSelect={setSelected} onFail={() => setSceneFailed(true)} />
          )}
        </div>

        <nav aria-label={villa ? "Social team" : "Brothers"} className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="px-2 pb-2 text-sm font-semibold text-slate-900">{villa ? "Social team" : "Brothers"}</h2>
          {data && agents.length === 0 && <p className="px-2 text-sm text-slate-500">Nobody lives here yet.</p>}
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

      {villa && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Latest posts</h2>
          {data && data.recentPosts.length === 0 && <p className="mt-2 text-sm text-slate-500">No posts yet. Creative Director writes one a day.</p>}
          <ul className="mt-3 divide-y divide-slate-100">
            {data?.recentPosts.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${POST_STATUS[p.status]}`}>{p.status.toLowerCase()}</span>
                  <span>
                    {p.audience} · {p.pillar} · {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {p.videoUrl && (
                  <video src={p.videoUrl} controls muted playsInline preload="metadata" className="mt-2 aspect-[9/16] w-40 rounded-lg bg-slate-900">
                    <track kind="captions" />
                  </video>
                )}
                <p className="mt-1 font-medium text-slate-900">{p.hook}</p>
                {p.spec.beats && (
                  <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700">
                    {p.spec.beats.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ol>
                )}
                <p className="mt-1 text-sm text-slate-500">
                  {p.caption} {p.spec.hashtags?.map((h) => `#${h}`).join(" ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AgentPanel agent={selectedAgent} onClose={() => setSelected(null)} onChanged={refresh} />
    </div>
  );
}
