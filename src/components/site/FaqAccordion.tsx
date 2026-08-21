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
    <div className="site-border divide-y">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium"
            >
              {item.question}
              <ChevronDown
                size={18}
                className="shrink-0 transition-transform"
                style={{ transform: open ? "rotate(180deg)" : undefined, color }}
              />
            </button>
            {open && <p className="pb-4 text-sm opacity-80">{item.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
