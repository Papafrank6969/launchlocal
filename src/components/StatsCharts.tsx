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
  ResponsiveContainer,
  Cell,
} from "recharts";

const INK_MUTED = "#898781";
const GRID = "#e1e0d9";
const SEQUENTIAL_BLUE = "#2a78d6";
const SEQUENTIAL_BLUE_FILL = "#cde2fb";

const STATUS_COLOR: Record<string, string> = {
  NONE: "#d03b3b", // critical — no website at all
  POOR: "#fab219", // warning — weak website
  HAS_SITE: "#0ca30c", // good — already has a site
};

export function StatsCharts({
  days,
  leadsByStatus,
}: {
  days: { date: string; views: number }[];
  leadsByStatus: { key: string; label: string; count: number }[];
}) {
  return (
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
  );
}
