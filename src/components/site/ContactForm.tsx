"use client";

import { useState } from "react";
import { FormStatus, type StatusMessage } from "@/components/FormStatus";

export function ContactForm({ slug, color }: { slug: string; color: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<StatusMessage>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setFieldErrors({});
    try {
      const res = await fetch(`/api/public/sites/${slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFieldErrors(data.errors ?? {});
        setStatus({ type: "error", text: "Please fix the errors below and try again." });
        return;
      }
      setStatus({ type: "success", text: "Message sent — we'll get back to you soon." });
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus({ type: "error", text: "Something went wrong — try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        {fieldErrors.message && <p className="mt-1 text-xs text-red-600">{fieldErrors.message}</p>}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: color }}
      >
        {submitting ? "Sending…" : "Send message"}
      </button>
      <FormStatus status={status} />
    </form>
  );
}
