import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Site",
  description: "Fill in the details and pick a template for a new business site.",
};

export default function NewSiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
