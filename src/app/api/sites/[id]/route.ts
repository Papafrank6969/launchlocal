import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeBookingUrl } from "@/lib/bookingUrl";
import { reconcileServices, type IncomingService } from "@/lib/serviceReconcile";
import { deleteUploadedFile } from "@/lib/imageUpload";

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
  "googlePlaceId",
] as const;

const EDITABLE_BOOLEAN_FIELDS = ["utmTrackingEnabled"] as const;

const EDITABLE_NUMBER_FIELDS = ["rating", "reviewCount"] as const;


export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await db.site.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, string | boolean | number | null> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) data[field] = body[field];
  }
  // Booking URL is validated/normalised, never stored as pasted.
  if ("bookingUrl" in body) data.bookingUrl = normalizeBookingUrl(body.bookingUrl);
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

  const services: IncomingService[] | undefined = Array.isArray(body.serviceItems) ? body.serviceItems : undefined;
  const orphanedImages: string[] = [];

  const site = await db.$transaction(async (tx) => {
    if (services) {
      const current = await tx.service.findMany({
        where: { siteId: id },
        select: { id: true, slug: true, imageUrl: true },
      });
      const { create, update, deleteIds } = reconcileServices(current, services);
      const oldImageById = new Map(current.map((c) => [c.id, c.imageUrl]));

      for (const delId of deleteIds) {
        const img = oldImageById.get(delId);
        if (img) orphanedImages.push(img);
      }
      if (deleteIds.length > 0) await tx.service.deleteMany({ where: { id: { in: deleteIds } } });
      for (const u of update) {
        const oldImg = oldImageById.get(u.id);
        if (oldImg && oldImg !== u.data.imageUrl) orphanedImages.push(oldImg);
        await tx.service.update({ where: { id: u.id }, data: u.data });
      }
      if (create.length > 0) {
        await tx.service.createMany({ data: create.map((row) => ({ ...row, siteId: id })) });
      }
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

  // Prune image files no longer referenced by any service (best-effort, post-commit).
  await Promise.all(orphanedImages.map((url) => deleteUploadedFile(url)));

  return NextResponse.json({ site });
}
