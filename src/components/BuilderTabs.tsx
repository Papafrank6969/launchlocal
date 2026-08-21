"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Site" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
  { href: "/gallery", label: "Gallery" },
];

export function BuilderTabs({ id }: { id: string }) {
  const pathname = usePathname();

  return (
    <div className="mt-6 flex gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const href = `/builder/${id}${t.href}`;
        const active = pathname === href;
        return (
          <Link
            key={t.href}
            href={href}
            className={`px-3 py-2 text-sm font-medium ${
              active ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
