"use client";

import { X } from "lucide-react";
import {
  activeFilterCount,
  DEFAULT_LEAD_FILTERS,
  LEAD_SORT_OPTIONS,
  type LeadFilters,
  type LeadSortKey,
} from "@/lib/leadBacklog";

export function LeadFilterBar({
  filters,
  onChange,
  sortKey,
  onSortChange,
  facets,
  total,
  shown,
}: {
  filters: LeadFilters;
  onChange: (next: LeadFilters) => void;
  sortKey: LeadSortKey;
  onSortChange: (key: LeadSortKey) => void;
  facets: { cities: string[]; trades: string[] };
  total: number;
  shown: number;
}) {
  const filterCount = activeFilterCount(filters);
  const isResetVisible = filterCount > 0 || sortKey !== "newest";

  function set<K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div role="group" aria-label="Filter and sort leads" className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="lf-work" className="block text-xs font-medium text-slate-500">
            Work state
          </label>
          <select
            id="lf-work"
            className="select-compact mt-1"
            value={filters.workState}
            onChange={(e) => set("workState", e.target.value as LeadFilters["workState"])}
          >
            <option value="unworked">Unworked</option>
            <option value="in-progress">In progress</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="all">All</option>
          </select>
        </div>

        <div>
          <label htmlFor="lf-website" className="block text-xs font-medium text-slate-500">
            Website
          </label>
          <select
            id="lf-website"
            className="select-compact mt-1"
            value={filters.website}
            onChange={(e) => set("website", e.target.value as LeadFilters["website"])}
          >
            <option value="opportunities">Opportunities (no/weak site)</option>
            <option value="none">No site</option>
            <option value="poor">Weak site</option>
            <option value="has-site">Has a site</option>
            <option value="all">All</option>
          </select>
        </div>

        <div>
          <label htmlFor="lf-city" className="block text-xs font-medium text-slate-500">
            City
          </label>
          <select
            id="lf-city"
            className="select-compact mt-1"
            value={filters.city ?? ""}
            onChange={(e) => set("city", e.target.value || null)}
          >
            <option value="">All cities</option>
            {facets.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="lf-trade" className="block text-xs font-medium text-slate-500">
            Trade
          </label>
          <select
            id="lf-trade"
            className="select-compact mt-1"
            value={filters.trade ?? ""}
            onChange={(e) => set("trade", e.target.value || null)}
          >
            <option value="">All trades</option>
            {facets.trades.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="lf-instagram" className="block text-xs font-medium text-slate-500">
            Instagram
          </label>
          <select
            id="lf-instagram"
            className="select-compact mt-1"
            value={filters.hasHandle}
            onChange={(e) => set("hasHandle", e.target.value as LeadFilters["hasHandle"])}
          >
            <option value="all">Any</option>
            <option value="yes">Has handle</option>
            <option value="no">Needs handle</option>
          </select>
        </div>

        <div>
          <label htmlFor="lf-draft" className="block text-xs font-medium text-slate-500">
            Draft site
          </label>
          <select
            id="lf-draft"
            className="select-compact mt-1"
            value={filters.hasDraft}
            onChange={(e) => set("hasDraft", e.target.value as LeadFilters["hasDraft"])}
          >
            <option value="all">Any</option>
            <option value="yes">Drafted</option>
            <option value="no">Not drafted</option>
          </select>
        </div>

        <div>
          <label htmlFor="lf-name" className="block text-xs font-medium text-slate-500">
            Name
          </label>
          <input
            id="lf-name"
            type="search"
            className="input mt-1 w-48 py-1.5"
            placeholder="Search by name"
            value={filters.nameQuery}
            onChange={(e) => set("nameQuery", e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="lf-sort" className="block text-xs font-medium text-slate-500">
            Sort
          </label>
          <select
            id="lf-sort"
            className="select-compact mt-1"
            value={sortKey}
            onChange={(e) => onSortChange(e.target.value as LeadSortKey)}
          >
            {LEAD_SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isResetVisible && (
          <button
            type="button"
            onClick={() => {
              onChange(DEFAULT_LEAD_FILTERS);
              onSortChange("newest");
            }}
            className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={12} aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Showing {shown} of {total}
        {filterCount > 0 ? ` · ${filterCount} filter${filterCount === 1 ? "" : "s"} active` : ""}
      </p>
    </div>
  );
}
