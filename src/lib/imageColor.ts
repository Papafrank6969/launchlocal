import sharp from "sharp";
import { rgbToHex, hexToHsl } from "@/lib/color";

/**
 * Pull a usable hue out of a photo so a drafted site's accent color can be
 * matched to the shop's own storefront/branding.
 *
 * The naive `sharp().stats().dominant` is the *most frequent* color, which for
 * almost any real photo is a muddy neutral (a beige wall, grey floor) — useless
 * as a brand signal. Instead we downsample hard and find the most common hue
 * *among the saturated pixels* (a neon sign, an accent wall, brand packaging).
 * A photo with no saturated pixels carries no colour signal → null, and the
 * caller falls back to a name hash.
 */

/** Minimum HSL saturation for a pixel/colour to count toward the hue vote. */
export const MIN_USABLE_SATURATION = 0.28;
/** Need at least this share of the image to be saturated for a confident read. */
const MIN_SATURATED_SHARE = 0.04;

export function dominantHueFromRgb(rgb: { r: number; g: number; b: number }): number | null {
  const { h, s, l } = hexToHsl(rgbToHex(rgb.r, rgb.g, rgb.b));
  if (s < MIN_USABLE_SATURATION || l < 0.06 || l > 0.96) return null;
  return h;
}

export async function dominantHueOf(buffer: Buffer): Promise<number | null> {
  try {
    const width = 64;
    const { data, info } = await sharp(buffer)
      .resize(width, width, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const bucketVotes = new Array(36).fill(0); // 10°-wide hue buckets
    const bucketHueSum = new Array(36).fill(0);
    let saturated = 0;
    let pixels = 0;

    for (let i = 0; i + channels - 1 < data.length; i += channels) {
      pixels++;
      const { h, s, l } = hexToHsl(rgbToHex(data[i], data[i + 1], data[i + 2]));
      if (s < MIN_USABLE_SATURATION || l < 0.12 || l > 0.9) continue;
      saturated++;
      // Weight by saturation so a vivid sign outvotes a lightly-tinted wall.
      const b = Math.min(35, Math.floor(h / 10));
      bucketVotes[b] += s;
      bucketHueSum[b] += h * s;
    }

    if (pixels === 0 || saturated / pixels < MIN_SATURATED_SHARE) return null;

    let best = -1;
    let bestVotes = 0;
    for (let b = 0; b < 36; b++) {
      if (bucketVotes[b] > bestVotes) {
        bestVotes = bucketVotes[b];
        best = b;
      }
    }
    if (best < 0) return null;
    return bucketHueSum[best] / bucketVotes[best];
  } catch {
    return null;
  }
}
