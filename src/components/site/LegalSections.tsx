import type { LegalSection } from "@/lib/legalContent";

/** Shared renderer for the Privacy / Terms / Cookie / Refund pages. */
export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.heading}>
          <h2 className="font-semibold">{s.heading}</h2>
          <p className="mt-1 text-sm opacity-80">{s.body}</p>
          {s.items && s.items.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm opacity-80">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
