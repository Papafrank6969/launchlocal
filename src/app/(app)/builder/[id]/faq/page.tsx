"use client";

import { use, useEffect, useState } from "react";
import { BuilderTabs } from "@/components/BuilderTabs";
import { FormStatus, autoClearStatus, type StatusMessage } from "@/components/FormStatus";
import { suggestedFaqs, type FaqSuggestion } from "@/lib/faqSuggestions";

type FaqItem = { id: string; question: string; answer: string; order: number };

export default function FaqAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<FaqItem[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<StatusMessage>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch(`/api/sites/${id}/faq`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
    fetch(`/api/sites/${id}`)
      .then((r) => r.json())
      .then((d) => setCategory(d.site?.category ?? null));
  }, [id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/sites/${id}/faq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add");
      setItems((prev) => [...(prev ?? []), data.item]);
      setQuestion("");
      setAnswer("");
    } catch (err) {
      autoClearStatus(setStatus, { type: "error", text: err instanceof Error ? err.message : "Couldn't add" });
    } finally {
      setAdding(false);
    }
  }

  async function addSuggestion(suggestion: FaqSuggestion) {
    const res = await fetch(`/api/sites/${id}/faq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(suggestion),
    });
    const data = await res.json();
    if (res.ok) setItems((prev) => [...(prev ?? []), data.item]);
  }

  const usedQuestions = new Set((items ?? []).map((it) => it.question.trim().toLowerCase()));
  const suggestions = suggestedFaqs(category).filter((f) => !usedQuestions.has(f.question.toLowerCase()));

  async function updateItem(itemId: string, patch: Partial<FaqItem>) {
    setItems((prev) => (prev ?? []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
  }

  async function saveItem(item: FaqItem) {
    await fetch(`/api/sites/${id}/faq/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: item.question, answer: item.answer }),
    });
  }

  async function removeItem(itemId: string) {
    await fetch(`/api/sites/${id}/faq/${itemId}`, { method: "DELETE" });
    setItems((prev) => (prev ?? []).filter((it) => it.id !== itemId));
  }

  async function move(index: number, dir: -1 | 1) {
    const list = items ?? [];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const a = list[index];
    const b = list[target];
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await Promise.all([
      fetch(`/api/sites/${id}/faq/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: target }),
      }),
      fetch(`/api/sites/${id}/faq/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: index }),
      }),
    ]);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">FAQ</h1>
      <p className="mt-1 text-slate-600">Questions and answers shown on this site&apos;s FAQ page.</p>
      <BuilderTabs id={id} />

      {suggestions.length > 0 && (
        <div className="mt-8 space-y-2 rounded-md border border-dashed border-blue-300 bg-blue-50/50 p-4">
          <p className="text-sm font-medium text-slate-700">
            Common questions clients ask before booking {category ? `a ${category}` : "this kind of service"}:
          </p>
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <button
                key={s.question}
                type="button"
                onClick={() => addSuggestion(s)}
                className="rounded-md border border-blue-300 bg-white px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                + {s.question}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {items === null && <p className="text-sm text-slate-500">Loading…</p>}
        {items?.length === 0 && <p className="text-sm text-slate-500">No FAQ items yet.</p>}
        {items?.map((item, i) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-4">
            <div className="flex items-start gap-2">
              <input
                className="input font-medium"
                value={item.question}
                onChange={(e) => updateItem(item.id, { question: e.target.value })}
                onBlur={() => saveItem(item)}
              />
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-xs text-slate-500 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === (items?.length ?? 0) - 1}
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 text-xs text-slate-500 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600"
              >
                Remove
              </button>
            </div>
            <textarea
              className="input mt-2 min-h-16 text-sm"
              value={item.answer}
              onChange={(e) => updateItem(item.id, { answer: e.target.value })}
              onBlur={() => saveItem(item)}
            />
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mt-8 space-y-3 rounded-md border border-dashed border-slate-300 p-4">
        <p className="text-sm font-medium text-slate-700">Add a question</p>
        <input
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question"
        />
        <textarea
          className="input min-h-16"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Answer"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add FAQ"}
        </button>
        <FormStatus status={status} />
      </form>
    </div>
  );
}
