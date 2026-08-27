"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const KEY = "launchlocal-cookie-consent";

function subscribeNoop() {
  return () => {};
}

function useMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export function CookieConsentBanner() {
  const mounted = useMounted();
  const [dismissed, setDismissed] = useState(false);
  const visible = mounted && !dismissed && !localStorage.getItem(KEY);
  const ref = useRef<HTMLDivElement>(null);

  // Publish the banner's height so the floating buttons can sit clear of it
  // while it's shown (and drop back down once it's dismissed).
  useEffect(() => {
    const root = document.documentElement;
    if (!visible || !ref.current) {
      root.style.removeProperty("--cookie-safe");
      return;
    }
    root.style.setProperty("--cookie-safe", `${ref.current.offsetHeight}px`);
    return () => {
      root.style.removeProperty("--cookie-safe");
    };
  }, [visible]);

  function accept() {
    localStorage.setItem(KEY, "accepted");
    setDismissed(true);
  }

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] print:hidden dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This site uses cookies to remember your preferences.
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
