"use client";

import Link from "next/link";

/** Small tab bar shared by the cold-outreach and follow-up consoles. */
export function OutreachNav({ active }: { active: "cold" | "follow-up" }) {
  const tabs = [
    { key: "cold" as const, href: "/outreach", label: "New leads" },
    { key: "follow-up" as const, href: "/outreach/follow-up", label: "Follow-ups" },
  ];

  return (
    <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active === tab.key
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
