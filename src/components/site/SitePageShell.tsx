import type { ReactNode } from "react";
import { fontCssValue, type DesignSystem } from "@/lib/designSystems";

export function SitePageShell({
  title,
  subtitle,
  wide = false,
  system,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  wide?: boolean;
  system: DesignSystem;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--site-bg)] text-[var(--site-fg)]" style={{ fontFamily: fontCssValue(system.fontBody) }}>
      <div className={`mx-auto px-8 py-16 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <h1 className="text-3xl font-bold" style={{ fontFamily: fontCssValue(system.fontHeading) }}>
          {title}
        </h1>
        {subtitle && <div className="mt-2 opacity-80">{subtitle}</div>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function LastUpdated({ date }: { date: Date }) {
  return (
    <p className="text-xs opacity-60">
      Last updated{" "}
      {date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
    </p>
  );
}
