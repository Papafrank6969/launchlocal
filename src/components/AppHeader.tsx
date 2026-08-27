"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/leads", label: "Lead Finder" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/builder", label: "Site Builder" },
  { href: "/stats", label: "Stats" },
];

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight dark:text-white" onClick={() => setMenuOpen(false)}>
          LaunchLocal
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex dark:text-slate-300">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname?.startsWith(link.href)
                  ? "text-slate-900 dark:text-white"
                  : "transition-colors hover:text-slate-900 dark:hover:text-white"
              }
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col border-t border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 sm:hidden dark:border-slate-800 dark:text-slate-300">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`py-2 ${pathname?.startsWith(link.href) ? "text-slate-900 dark:text-white" : "hover:text-slate-900 dark:hover:text-white"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
