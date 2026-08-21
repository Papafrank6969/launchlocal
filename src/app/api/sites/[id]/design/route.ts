import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chooseDesign } from "@/lib/generateDesign";
import { getDesignSystem } from "@/lib/designSystems";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({
    where: { id },
    include: { serviceItems: { orderBy: { order: "asc" }, take: 10 } },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const overrideSystemId = typeof body.systemId === "string" ? body.systemId : null;

  let choice;
  if (overrideSystemId) {
    choice = { system: getDesignSystem(overrideSystemId), rationale: "Manually selected by operator.", aiGenerated: false };
  } else {
    choice = await chooseDesign({
      businessName: site.businessName,
      category: site.category,
      tagline: site.tagline,
      about: site.about,
      serviceNames: site.serviceItems.map((s) => s.name),
    });
  }

  const updated = await db.site.update({
    where: { id },
    data: { designSystemId: choice.system.id, designRationale: choice.rationale },
  });

  return NextResponse.json({
    site: updated,
    designSystemName: choice.system.name,
    aiGenerated: choice.aiGenerated,
  });
}
