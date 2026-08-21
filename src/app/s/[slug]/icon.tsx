import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });
  const initial = (site?.businessName?.trim()?.[0] ?? "?").toUpperCase();
  const color = site?.primaryColor || "#2563eb";

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
          color: "#ffffff",
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
