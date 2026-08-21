import type { Metadata } from "next";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id }, select: { businessName: true } });
  return {
    title: site ? `Edit — ${site.businessName}` : "Edit Site",
    description: "Edit business details, choose a template, and publish.",
  };
}

export default function EditSiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
