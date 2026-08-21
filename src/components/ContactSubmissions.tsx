"use client";

import { useEffect, useState } from "react";

type Submission = { id: string; name: string; email: string; message: string; read: boolean; createdAt: string };

export function ContactSubmissions({ siteId }: { siteId: string }) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);

  useEffect(() => {
    fetch(`/api/sites/${siteId}/contact-submissions`)
      .then((r) => r.json())
      .then((d) => setSubmissions(d.submissions ?? []));
  }, [siteId]);

  async function markRead(id: string) {
    setSubmissions((prev) => (prev ?? []).map((s) => (s.id === id ? { ...s, read: true } : s)));
    await fetch(`/api/sites/${siteId}/contact-submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
  }

  if (submissions === null || submissions.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">
        Contact form messages{" "}
        {submissions.some((s) => !s.read) && (
          <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {submissions.filter((s) => !s.read).length} new
          </span>
        )}
      </h2>
      <div className="mt-4 space-y-3">
        {submissions.map((s) => (
          <div
            key={s.id}
            className={`rounded-md border p-4 ${s.read ? "border-slate-200" : "border-blue-300 bg-blue-50/50"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-900">
                {s.name} <span className="font-normal text-slate-500">· {s.email}</span>
              </p>
              {!s.read && (
                <button
                  type="button"
                  onClick={() => markRead(s.id)}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Mark as read
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-700">{s.message}</p>
            <p className="mt-1 text-xs text-slate-400">{new Date(s.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
