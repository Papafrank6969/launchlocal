"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollProgressBar } from "@/components/site/ScrollProgressBar";

export function StickyHeader({
  businessName,
  color,
  navLinks,
}: {
  businessName: string;
  color: string;
  navLinks: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden dark:border-slate-800 dark:bg-slate-950/90">
      <div className="relative">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <a href="#top" className="truncate text-sm font-semibold" style={{ color }}>
            {businessName}
          </a>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex dark:text-slate-300">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="scroll-mt-20 transition-colors hover:text-slate-900 dark:hover:text-white">
                {l.label}
              </a>
            ))}
            <ThemeToggle />
          </nav>

          <div className="flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            {navLinks.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? "Close menu" : "Open menu"}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
          </div>
        </div>

        {open && navLinks.length > 0 && (
          <nav className="flex flex-col border-t border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 sm:hidden dark:border-slate-800 dark:text-slate-300">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2">
                {l.label}
              </a>
            ))}
          </nav>
        )}

        <ScrollProgressBar color={color} />
      </div>
    </header>
  );
}
