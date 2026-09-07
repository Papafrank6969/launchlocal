import type { Metadata } from "next";
import { LegalSections } from "@/components/site/LegalSections";
import { generateAppPrivacyPolicy, LEGAL_LAST_UPDATED } from "@/lib/legalContent";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: false, follow: false },
};

export default function AppPrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-slate-900">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-xs text-slate-500">
        Last updated{" "}
        {LEGAL_LAST_UPDATED.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
      </p>
      <div className="mt-8">
        <LegalSections sections={generateAppPrivacyPolicy()} />
      </div>
    </div>
  );
}
