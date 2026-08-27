"use client";

import { Printer } from "lucide-react";

export function PrintButton({ color, label = "Print this list" }: { color: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="site-border inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80 print:hidden"
      style={{ color }}
    >
      <Printer size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
