import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lead Finder",
  description: "Search businesses by city and category and find the ones with no website or a weak one.",
};

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
