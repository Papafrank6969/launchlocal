import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chooseDesign } from "@/lib/generateDesign";
import { getDesignSystem, variantsOf, applyColorVariant, VARIANT_COUNT } from "@/lib/designSystems";
import { dominantHueOf } from "@/lib/imageColor";

/** Dominant hue of the first inspiration screenshot on disk, best-effort. */
async function dominantHueFromInspiration(urls: string[]): Promise<number | null> {
  for (const url of urls) {
    try {
      const bytes = await readFile(path.join(process.cwd(), "public", url));
      const hue = await dominantHueOf(bytes);
      if (hue != null) return hue;
    } catch {
      // try the next one
    }
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({
    where: { id },
    include: {
      serviceItems: { orderBy: { order: "asc" }, take: 10 },
      inspirationImages: { orderBy: { order: "asc" } },
    },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const overrideSystemId = typeof body.systemId === "string" ? body.systemId : null;
  const explicitVariant =
    Number.isInteger(body.variant) && body.variant >= 0 && body.variant < VARIANT_COUNT
      ? (body.variant as number)
      : null;

  let systemId: string;
  let rationale: string;
  let aiGenerated: boolean;
  let variant: number;

  if (explicitVariant != null) {
    // Operator clicked a specific accent swatch — keep the system, swap the tint.
    systemId = site.designSystemId ?? getDesignSystem(null).id;
    rationale = site.designRationale ?? "Manually selected by operator.";
    aiGenerated = false;
    variant = explicitVariant;
  } else if (overrideSystemId) {
    systemId = getDesignSystem(overrideSystemId).id;
    rationale = "Manually selected by operator.";
    aiGenerated = false;
    // Keep the current tint index if it's still in range, else the base.
    variant = site.colorVariant != null && site.colorVariant < VARIANT_COUNT ? site.colorVariant : 0;
  } else {
    const dominantHue = await dominantHueFromInspiration(site.inspirationImages.map((img) => img.url));
    const choice = await chooseDesign({
      businessName: site.businessName,
      category: site.category,
      tagline: site.tagline,
      about: site.about,
      serviceNames: site.serviceItems.map((s) => s.name),
      inspirationImageUrls: site.inspirationImages.map((img) => img.url),
      dominantHue,
    });
    systemId = choice.system.id;
    rationale = choice.rationale;
    aiGenerated = choice.aiGenerated;
    variant = choice.variant;
  }

  const updated = await db.site.update({
    where: { id },
    data: { designSystemId: systemId, designRationale: rationale, colorVariant: variant },
  });

  const system = getDesignSystem(systemId);
  return NextResponse.json({
    site: updated,
    designSystemName: system.name,
    aiGenerated,
    colorVariant: variant,
    colorVariantName: variantsOf(system)[variant]?.name ?? variantsOf(system)[0].name,
    palette: applyColorVariant(system, variant),
  });
}
