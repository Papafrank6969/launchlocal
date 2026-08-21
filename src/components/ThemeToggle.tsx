"use client";

import { useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "launchlocal-theme";

function subscribeNoop() {
  return () => {};
}

// Reading `document`/`localStorage` directly is only safe once we know we're
// past hydration — useSyncExternalStore is the React-sanctioned way to get
// that "mounted" signal without a setState-in-effect anti-pattern.
function useMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export function ThemeToggle({ className }: { className?: string }) {
  const mounted = useMounted();
  const [, forceRerender] = useState(0);
  const dark = mounted && document.documentElement.classList.contains("dark");

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(KEY, next ? "dark" : "light");
    forceRerender((n) => n + 1);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? (dark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      className={
        className ??
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      }
    >
      {mounted ? dark ? <Sun size={16} /> : <Moon size={16} /> : <span className="block h-4 w-4" />}
    </button>
  );
}

export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    KEY,
  )});var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
