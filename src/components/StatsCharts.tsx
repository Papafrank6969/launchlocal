"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { DayRow } from "@/lib/funnel";

const INK_MUTED = "#898781";
const GRID = "#e1e0d9";
const SEQUENTIAL_BLUE = "#2a78d6";
const SEQUENTIAL_BLUE_FILL = "#cde2fb";

const STATUS_COLOR: Record<string, string> = {
  NONE: "#d03b3b", // critical — no website at all
  POOR: "#fab219", // warning — weak website
  HAS_SITE: "#0ca30c", // good — already has a site
};

// Operator palette only — blue-600 primary, emerald-600 for the winning stage,
// amber + slate as the two additional series so all four are distinguishable.
const FUNNEL_COLORS = {
  contacted: "#2563eb",
  responded: "#d97706",
  won: "#059669",
  contactForm: "#64748b",
};

const FUNNEL_LABELS: Record<keyof typeof FUNNEL_COLORS, string> = {
  contacted: "Contacted",
  responded: "Responded",
  won: "Won",
  contactForm: "Contact form",
};

export function StatsCharts({
  days,
  leadsByStatus,
  funnelDays,
}: {
  days: { date: string; views: number }[];
  leadsByStatus: { key: string; label: string; count: number }[];
  funnelDays: DayRow[];
}) {
  return (
    <>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Site views, last 30 days</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: INK_MUTED }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: INK_MUTED }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e1e0d9" }}
                  labelStyle={{ color: "#0b0b0b", fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke={SEQUENTIAL_BLUE}
                  strokeWidth={2}
                  fill={SEQUENTIAL_BLUE_FILL}
                  fillOpacity={0.6}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Leads by website status</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsByStatus} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: INK_MUTED }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: INK_MUTED }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e1e0d9" }}
                  labelStyle={{ color: "#0b0b0b", fontWeight: 600 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  {leadsByStatus.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLOR[entry.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">Funnel over time, last 30 days</h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={funnelDays} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: INK_MUTED }}
                axisLine={{ stroke: GRID }}
                tickLine={false}
                interval={6}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: INK_MUTED }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e1e0d9" }}
                labelStyle={{ color: "#0b0b0b", fontWeight: 600 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: INK_MUTED }}
                iconType="plainline"
                iconSize={12}
              />
              {(Object.keys(FUNNEL_COLORS) as (keyof typeof FUNNEL_COLORS)[]).map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={FUNNEL_LABELS[key]}
                  stroke={FUNNEL_COLORS[key]}
                  strokeWidth={2}
                  fill={FUNNEL_COLORS[key]}
                  fillOpacity={0.08}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
