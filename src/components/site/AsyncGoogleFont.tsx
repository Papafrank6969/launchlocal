"use client";

import { useEffect } from "react";

/**
 * Loads a Google Fonts stylesheet without blocking first paint. A plain
 * <link rel="stylesheet"> (or React 19's precedence-managed stylesheet) both
 * block rendering until the CSS loads — React's stylesheet system does this
 * on purpose to avoid FOUC, but for a per-site custom font that's the wrong
 * tradeoff: it turned into a ~800ms render-blocking hit on LCP in Lighthouse.
 * Injecting the <link> after mount lets the page paint immediately with the
 * fallback font (the Google Fonts URL already carries display=swap), then
 * swap to the real font once it arrives.
 */
export function AsyncGoogleFont({ href }: { href: string }) {
  useEffect(() => {
    if (document.querySelector(`link[data-async-font="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.asyncFont = href;
    document.head.appendChild(link);
  }, [href]);

  return null;
}
