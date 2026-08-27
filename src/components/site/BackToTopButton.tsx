"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { readableTextColor } from "@/lib/contrast";

export function BackToTopButton({ color }: { color: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 480);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="fixed bottom-[calc(1.5rem+var(--cookie-safe,0px))] left-6 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-[opacity,bottom] hover:opacity-90 print:hidden"
      style={{ backgroundColor: color, color: readableTextColor(color) }}
    >
      <ArrowUp size={18} />
    </button>
  );
}
