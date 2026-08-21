"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({
  items,
  color,
}: {
  items: { question: string; answer: string }[];
  color: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium text-slate-900 dark:text-white"
            >
              {item.question}
              <ChevronDown
                size={18}
                className="shrink-0 transition-transform"
                style={{ transform: open ? "rotate(180deg)" : undefined, color }}
              />
            </button>
            {open && <p className="pb-4 text-sm text-slate-600 dark:text-slate-300">{item.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
