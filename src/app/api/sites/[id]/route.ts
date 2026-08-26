import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await db.site.findUnique({
    where: { id },
    include: { lead: true, serviceItems: { orderBy: { order: "asc" } } },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ site });
}

const EDITABLE_FIELDS = [
  "businessName",
  "tagline",
  "about",
  "story",
  "hours",
  "phone",
  "email",
  "address",
  "instagramHandle",
  "facebookUrl",
  "guaranteeText",
  "paymentMethods",
  "googleSiteVerification",
  "category",
] as const;

const EDITABLE_BOOLEAN_FIELDS = ["utmTrackingEnabled"] as const;

const EDITABLE_NUMBER_FIELDS = ["rating", "reviewCount"] as const;

type ServiceInput = { name: string; description?: string | null; price?: string | null };

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await db.site.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, string | boolean | number | null> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) data[field] = body[field];
  }
  for (const field of EDITABLE_BOOLEAN_FIELDS) {
    if (field in body) data[field] = Boolean(body[field]);
  }
  for (const field of EDITABLE_NUMBER_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === "") {
      data[field] = null;
      continue;
    }
    const n = Number(raw);
    data[field] = Number.isNaN(n) ? null : n;
  }

  let status = existing.status;
  if (body.status === "PUBLISHED" || body.status === "DRAFT") {
    status = body.status;
  }

  const services: ServiceInput[] | undefined = Array.isArray(body.serviceItems) ? body.serviceItems : undefined;

  const site = await db.$transaction(async (tx) => {
    if (services) {
      const seen = new Set<string>();
      const rows = services
        .map((s) => ({
          name: (s.name ?? "").trim(),
          description: (s.description ?? "").trim() || null,
          price: (s.price ?? "").trim() || null,
        }))
        .filter((s) => s.name.length > 0)
        .map((s, i) => {
          let slug = slugify(s.name) || `service-${i + 1}`;
          let n = 1;
          while (seen.has(slug)) {
            n += 1;
            slug = `${slugify(s.name)}-${n}`;
          }
          seen.add(slug);
          return { siteId: id, slug, name: s.name, description: s.description, price: s.price, order: i };
        });
      await tx.service.deleteMany({ where: { siteId: id } });
      if (rows.length > 0) await tx.service.createMany({ data: rows });
    }

    const updated = await tx.site.update({
      where: { id },
      data: { ...data, status },
      include: { serviceItems: { orderBy: { order: "asc" } } },
    });

    if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      await tx.event.create({ data: { type: "SITE_PUBLISHED", siteId: updated.id } });
    }

    return updated;
  });

  return NextResponse.json({ site });
}
