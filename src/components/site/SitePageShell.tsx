import type { ReactNode } from "react";

export function SitePageShell({
  title,
  subtitle,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className={`mx-auto px-8 py-16 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <div className="mt-2 text-slate-600 dark:text-slate-300">{subtitle}</div>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function LastUpdated({ date }: { date: Date }) {
  return (
    <p className="text-xs text-slate-400 dark:text-slate-500">
      Last updated{" "}
      {date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
    </p>
  );
}
