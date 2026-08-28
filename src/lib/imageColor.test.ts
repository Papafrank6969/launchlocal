import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { dominantHueFromRgb, dominantHueOf } from "./imageColor";
import { hueDistance } from "./color";

describe("dominantHueFromRgb", () => {
  it("returns the hue of a clearly coloured pixel", () => {
    expect(Math.round(dominantHueFromRgb({ r: 200, g: 20, b: 20 }) ?? -1)).toBe(0);
    expect(Math.round(dominantHueFromRgb({ r: 20, g: 20, b: 200 }) ?? -1)).toBe(240);
  });

  it("returns null for a near-grey pixel (no usable hue)", () => {
    expect(dominantHueFromRgb({ r: 128, g: 130, b: 127 })).toBeNull();
  });

  it("returns null for near-black and near-white", () => {
    expect(dominantHueFromRgb({ r: 8, g: 4, b: 6 })).toBeNull();
    expect(dominantHueFromRgb({ r: 250, g: 249, b: 252 })).toBeNull();
  });
});

async function solidPng(r: number, g: number, b: number): Promise<Buffer> {
  return sharp({ create: { width: 16, height: 16, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
}

describe("dominantHueOf", () => {
  it("reads the dominant hue off a solid-colour image", async () => {
    const hue = await dominantHueOf(await solidPng(30, 120, 200));
    expect(hue).not.toBeNull();
    expect(hueDistance(hue as number, 205)).toBeLessThan(20);
  });

  it("returns null for a grey image", async () => {
    expect(await dominantHueOf(await solidPng(140, 140, 140))).toBeNull();
  });

  it("returns null for a buffer that isn't an image", async () => {
    expect(await dominantHueOf(Buffer.from("not an image"))).toBeNull();
  });

  it("finds the saturated accent even when a neutral is the most common colour", async () => {
    // 90% grey wall, 10% vivid magenta sign — dominant-by-frequency would say
    // grey; we want the magenta.
    const base = sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 150, g: 150, b: 150 } } });
    const sign = await sharp({ create: { width: 100, height: 10, channels: 3, background: { r: 210, g: 20, b: 140 } } })
      .png()
      .toBuffer();
    const composed = await base.composite([{ input: sign, top: 0, left: 0 }]).png().toBuffer();
    const hue = await dominantHueOf(composed);
    expect(hue).not.toBeNull();
    expect(hueDistance(hue as number, 327)).toBeLessThan(20);
  });
});
