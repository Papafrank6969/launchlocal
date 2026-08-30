"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";

type HandoffTask = {
  key: string;
  label: string;
  help: string;
  done: boolean;
  doneAt: string | null;
  order: number;
};

type HandoffProgress = {
  total: number;
  done: number;
  pct: number;
  complete: boolean;
  nextStep: { key: string; label: string; help: string } | null;
};

type HandoffPayload = {
  tasks: HandoffTask[];
  progress: HandoffProgress;
  summary: string;
  deliveredAt: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function HandoffPanel({ siteId }: { siteId: string }) {
  const [data, setData] = useState<HandoffPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [errorKeys, setErrorKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sites/${siteId}/handoff`)
      .then((r) => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setData({ tasks: [], progress: { total: 0, done: 0, pct: 0, complete: false, nextStep: null }, summary: "", deliveredAt: null });
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  async function toggle(key: string, done: boolean) {
    if (!data || saving.has(key)) return;

    setSaving((prev) => new Set(prev).add(key));
    setErrorKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setData((prev) =>
      prev
        ? { ...prev, tasks: prev.tasks.map((t) => (t.key === key ? { ...t, done } : t)) }
        : prev
    );

    try {
      const res = await fetch(`/api/sites/${siteId}/handoff`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, done }),
      });
      if (!res.ok) throw new Error("save failed");
      const payload = await res.json();
      setData(payload);
    } catch {
      setData((prev) =>
        prev
          ? { ...prev, tasks: prev.tasks.map((t) => (t.key === key ? { ...t, done: !done } : t)) }
          : prev
      );
      setErrorKeys((prev) => new Set(prev).add(key));
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (!data) {
    return <p className="mt-3 text-xs text-slate-500">Loading handoff…</p>;
  }

  const { tasks, progress, summary, deliveredAt } = data;
  const checkedCount = tasks.filter((t) => t.done).length;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-sm font-medium text-blue-600 hover:underline"
      >
        <span>Handoff</span>
        <ChevronDown size={16} className={open ? "rotate-180" : ""} />
      </button>

      <div className="mt-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${progress.pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          {progress.complete ? (
            <span className="text-emerald-700">
              Delivered {deliveredAt ? formatDate(deliveredAt) : formatDate(tasks[0]?.doneAt ?? null)}
            </span>
          ) : (
            <span className="text-slate-600">
              {checkedCount}/{progress.total} handoff steps
            </span>
          )}
          <CopyButton text={summary} label="Copy summary" copiedLabel="Copied ✓" />
        </div>
      </div>

      {open && (
        <ul className="mt-3 space-y-2">
          {tasks.map((task) => (
            <li key={task.key}>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={task.done}
                  disabled={saving.has(task.key)}
                  aria-describedby={errorKeys.has(task.key) ? `handoff-error-${task.key}` : undefined}
                  onChange={() => toggle(task.key, !task.done)}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span className="text-sm text-slate-700">{task.label}</span>
              </label>
              <p className="pl-6 text-xs text-slate-500">{task.help}</p>
              {errorKeys.has(task.key) && (
                <p id={`handoff-error-${task.key}`} className="pl-6 text-xs text-red-600">
                  Couldn&apos;t save
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
