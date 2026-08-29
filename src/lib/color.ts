import { contrastRatio } from "@/lib/contrast";

/**
 * Small HSL toolkit for building per-business color variants of a design
 * system. Rotating hue keeps the eye's sense of "same family" while producing a
 * visibly different palette; `adjustLightnessToContrast` is the safety valve
 * that keeps every generated variant readable.
 */

export type Hsl = { h: number; s: number; l: number };

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const lig = clamp01(l);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  const [r1, g1, b1] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

export function hueOf(hex: string): number {
  return hexToHsl(hex).h;
}

/** Shortest angular distance between two hues, 0-180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export function rotateHue(hex: string, deg: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, h: hsl.h + deg });
}

/**
 * Nudge a color's lightness (up or down, whichever direction helps) until it
 * clears `minRatio` against `against`, or give up after a bounded search and
 * return the best attempt.
 */
export function adjustLightnessToContrast(hex: string, against: string, minRatio: number): string {
  if (contrastRatio(hex, against) >= minRatio) return hex;
  const hsl = hexToHsl(hex);
  // If black reads better than white on `against`, `against` is light — so darken.
  const againstIsLight = contrastRatio(against, "#000000") >= contrastRatio(against, "#ffffff");
  const dir = againstIsLight ? -1 : 1;
  let best = hex;
  let bestRatio = contrastRatio(hex, against);
  for (let step = 1; step <= 20; step++) {
    const candidate = hslToHex({ ...hsl, l: clamp01(hsl.l + dir * step * 0.03) });
    const ratio = contrastRatio(candidate, against);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= minRatio) return candidate;
  }
  return best;
}
