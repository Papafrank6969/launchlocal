import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { resolveDesignSystem } from "@/lib/templates";
import { readableTextColor } from "@/lib/contrast";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  const initial = (site?.businessName?.trim()?.[0] ?? "?").toUpperCase();
  const color = site ? resolveDesignSystem(site).colorPrimary : "#2563eb";
  const textColor = readableTextColor(color);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          borderRadius: 7,
          color: textColor,
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {initial}
      </div>
    ),
    { ...size }
  );
}
