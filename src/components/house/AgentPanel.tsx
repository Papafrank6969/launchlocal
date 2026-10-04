"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { HouseResponse } from "@/app/api/house/route";
import type { AgentDetail } from "@/app/api/agents/[id]/route";
import { CHAT_MAX_CHARS } from "@/lib/agentChat";
import { formatMicros } from "@/lib/houseStats";

type Agent = HouseResponse["agents"][number];
const TABS = ["Now", "Queue", "Schedule", "Chat", "Approvals"] as const;
type Tab = (typeof TABS)[number];

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "–");

export function AgentPanel({ agent, onClose, onChanged }: { agent: Agent | null; onClose: () => void; onChanged: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>("Now");
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const id = agent?.id ?? null;

  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/agents/${id}`, { cache: "no-store" });
    if (res.ok) setDetail(await res.json());
  }, [id]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (id && !dialog.open) dialog.showModal();
    if (!id && dialog.open) dialog.close();
    setDetail(null);
    setNote(null);
    setTab("Now");
    load();
  }, [id, load]);

  async function runNow() {
    if (!id) return;
    setRunning(true);
    setNote(null);
    onChanged();
    try {
      const res = await fetch(`/api/agents/${id}/run`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      setNote(res.ok ? `Run finished: ${body.outcome}${body.error ? ` (${body.error})` : ""}` : (body.error ?? `HTTP ${res.status}`));
    } finally {
      setRunning(false);
      onChanged();
      load();
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="agent-panel-title"
      className="m-0 ml-auto h-full max-h-none w-full max-w-none bg-white p-0 shadow-xl backdrop:bg-slate-900/40 sm:max-w-md"
    >
      {agent && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-slate-200 p-4">
            <div>
              <h2 id="agent-panel-title" className="text-lg font-semibold text-slate-900">
                {agent.name}
              </h2>
              <p className="text-sm text-slate-600">{agent.role}</p>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div role="tablist" aria-label="Brother details" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  tab === t ? "border-blue-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t}
                {t === "Approvals" && agent.pending > 0 ? ` (${agent.pending})` : ""}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="flex-1 overflow-y-auto p-4 text-sm text-slate-700">
            {tab === "Now" && (
              <div className="space-y-3">
                <p>
                  <span className="font-medium text-slate-900">Status:</span> {running ? "RUNNING" : agent.status}
                  {agent.currentTask && ` · ${agent.currentTask}`}
                </p>
                {agent.lastRun ? (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="font-medium text-slate-900">Last run: {agent.lastRun.outcome}</div>
                    <div>{agent.lastRun.summary ?? "No summary"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatMicros(agent.lastRun.costMicros)} · {when(agent.lastRun.finishedAt)}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500">Hasn&apos;t run yet.</p>
                )}
                <button
                  type="button"
                  onClick={runNow}
                  disabled={running || agent.status === "RUNNING" || agent.status === "OFF"}
                  className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white transition-colors duration-150 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
                >
                  {running ? "Running…" : "Run now"}
                </button>
                {note && <p role="status">{note}</p>}
              </div>
            )}

            {tab === "Queue" &&
              (!detail ? (
                <p className="text-slate-500">Loading…</p>
              ) : detail.tasks.length === 0 ? (
                <p className="text-slate-500">Nothing queued.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.tasks.map((t) => (
                    <li key={t.id} className="rounded-lg bg-slate-50 p-3">
                      <span className="font-medium text-slate-900">{t.kind}</span>
                      <span className="block text-xs text-slate-500">queued {when(t.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ))}

            {tab === "Schedule" && (
              <div className="space-y-3">
                <p>Runs daily at 17:30 UTC (1:30pm ET in summer, 12:30pm in winter).</p>
                {!detail ? (
                  <p className="text-slate-500">Loading…</p>
                ) : detail.runs.length === 0 ? (
                  <p className="text-slate-500">No runs yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.runs.map((r) => (
                      <li key={r.id} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-slate-900">{r.outcome ?? "RUNNING"}</span>
                          <span className="text-xs text-slate-500">
                            {r.trigger.toLowerCase()} · {formatMicros(r.costMicros)} · {when(r.startedAt)}
                          </span>
                        </div>
                        {(r.summary || r.error) && <div className="mt-1">{r.error ?? r.summary}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === "Chat" && <ChatTab agentId={agent.id} messages={detail?.messages ?? null} onSent={() => (load(), onChanged())} />}

            {tab === "Approvals" && (
              <div className="space-y-3">
                <p className="rounded-md bg-blue-50 px-3 py-2 text-blue-800">Approve / edit / reject arrives next.</p>
                {!detail ? (
                  <p className="text-slate-500">Loading…</p>
                ) : detail.approvals.length === 0 ? (
                  <p className="text-slate-500">No drafts waiting.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.approvals.map((a) => (
                      <li key={a.id} className="rounded-lg bg-slate-50 p-3">
                        <div className="font-medium text-slate-900">{a.title}</div>
                        <div className="text-xs text-slate-500">
                          {a.kind} · {when(a.createdAt)}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{a.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

function ChatTab({ agentId, messages, onSent }: { agentId: string; messages: AgentDetail["messages"] | null; onSent: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? `HTTP ${res.status}`);
      else setText("");
    } finally {
      setSending(false);
      onSent();
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <ul className="flex-1 space-y-2" aria-live="polite">
        {messages === null && <li className="text-slate-500">Loading…</li>}
        {messages?.length === 0 && <li className="text-slate-500">Say something. Each reply costs a little from today&apos;s budget.</li>}
        {messages?.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 ${m.role === "user" ? "ml-auto bg-blue-600 text-white" : "bg-slate-100 text-slate-900"}`}>
            {m.content}
          </li>
        ))}
        {sending && <li className="text-slate-500">Typing…</li>}
      </ul>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <form onSubmit={send} className="flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={CHAT_MAX_CHARS}
          placeholder="What did you do today?"
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-blue-600"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
