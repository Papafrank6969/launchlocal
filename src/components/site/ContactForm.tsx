"use client";

import { useId, useState } from "react";
import { FormStatus, type StatusMessage } from "@/components/FormStatus";
import { readableTextColor } from "@/lib/contrast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm({ slug, color }: { slug: string; color: string }) {
  const idPrefix = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<StatusMessage>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name is required.";
    if (!email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!message.trim()) errors.message = "Message is required.";
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setStatus({ type: "error", text: "Please fix the errors below and try again." });
      return;
    }

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

  const nameId = `${idPrefix}-name`;
  const emailId = `${idPrefix}-email`;
  const messageId = `${idPrefix}-message`;
  const inputClass = "site-border site-card-bg mt-1 w-full rounded-md border px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor={nameId} className="block text-sm font-medium">
          Name
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? `${nameId}-error` : undefined}
          className={inputClass}
        />
        {fieldErrors.name && (
          <p id={`${nameId}-error`} className="mt-1 text-xs text-red-600">
            {fieldErrors.name}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={emailId} className="block text-sm font-medium">
          Email
        </label>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
          className={inputClass}
        />
        {fieldErrors.email && (
          <p id={`${emailId}-error`} className="mt-1 text-xs text-red-600">
            {fieldErrors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={messageId} className="block text-sm font-medium">
          Message
        </label>
        <textarea
          id={messageId}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          required
          aria-invalid={Boolean(fieldErrors.message)}
          aria-describedby={fieldErrors.message ? `${messageId}-error` : undefined}
          className={inputClass}
        />
        {fieldErrors.message && (
          <p id={`${messageId}-error`} className="mt-1 text-xs text-red-600">
            {fieldErrors.message}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md px-5 py-2.5 font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: color, color: readableTextColor(color) }}
      >
        {submitting ? "Sending…" : "Send message"}
      </button>
      <FormStatus status={status} />
    </form>
  );
}
