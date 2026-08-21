import Image from "next/image";
import { parseHours, isOpenNow } from "@/lib/hours";

export type SiteData = {
  businessName: string;
  tagline?: string | null;
  about?: string | null;
  story?: string | null;
  hours?: string | null;
  phone?: string | null;
  address?: string | null;
  instagramHandle?: string | null;
  facebookUrl?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  guaranteeText?: string | null;
  paymentMethods?: string | null;
  template: string;
  primaryColor: string;
  slug?: string | null;
  serviceItems?: { id?: string; slug?: string; name: string; description?: string | null }[];
};

function Photo({
  site,
  className = "relative h-64 w-full sm:h-96",
  sizes = "100vw",
}: {
  site: SiteData;
  className?: string;
  sizes?: string;
}) {
  if (!site.photoUrl) return null;
  return (
    <div className={className}>
      <Image src={site.photoUrl} alt={site.businessName} fill className="object-cover" sizes={sizes} priority />
    </div>
  );
}

export function instagramDmUrl(handle?: string | null): string | null {
  if (!handle) return null;
  const clean = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
  if (!clean) return null;
  return `https://ig.me/m/${clean}`;
}

export const TEMPLATES = [
  { id: "classic", name: "Classic", description: "Editorial serif, centered hero, understated dividers." },
  { id: "modern", name: "Modern", description: "Split hero, numbered service tiles, confident sans-serif." },
  { id: "bold", name: "Bold", description: "Full-bleed color block, oversized type, hard-edged tiles." },
] as const;

function serviceHref(site: SiteData, item: { slug?: string }): string | null {
  if (!site.slug || !item.slug) return null;
  return `/s/${site.slug}/services/${item.slug}`;
}

function Eyebrow({ children, color, className = "" }: { children: React.ReactNode; color: string; className?: string }) {
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-[0.2em] ${className}`}
      style={{ color }}
    >
      {children}
    </p>
  );
}

export function SitePreview({ site }: { site: SiteData }) {
  const services = site.serviceItems ?? [];
  const color = site.primaryColor || "#2563eb";
  const aboutText = site.about || site.story;

  if (site.template === "bold") {
    return (
      <div id="top" className="min-h-screen bg-white dark:bg-slate-950">
        <section className="relative overflow-hidden border-b-4 border-slate-900 px-8 py-24 text-center text-white dark:border-white" style={{ backgroundColor: color }}>
          <h1 className="break-words text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            {site.businessName}
          </h1>
          {site.tagline && <p className="mx-auto mt-5 max-w-xl text-xl font-medium opacity-90">{site.tagline}</p>}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {site.phone && (
              <a
                href={`tel:${site.phone}`}
                className="inline-block rounded-md bg-white px-7 py-3.5 text-base font-bold shadow-[4px_4px_0_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5"
                style={{ color }}
              >
                Call {site.phone}
              </a>
            )}
            {instagramDmUrl(site.instagramHandle) && (
              <a
                href={instagramDmUrl(site.instagramHandle)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md border-2 border-white px-7 py-3.5 text-base font-bold text-white transition-colors hover:bg-white/10"
              >
                DM us on Instagram
              </a>
            )}
          </div>
        </section>
        <Photo site={site} />
        {aboutText && (
          <section id="about" className="mx-auto max-w-3xl scroll-mt-20 px-8 py-20 text-center">
            <Eyebrow color={color}>About</Eyebrow>
            <p className="mt-4 text-2xl font-medium leading-snug text-slate-900 dark:text-white">{aboutText}</p>
          </section>
        )}
        {services.length > 0 && (
          <section id="services" className="scroll-mt-20 bg-slate-50 px-8 py-20 dark:bg-slate-900">
            <div className="mx-auto max-w-4xl text-center">
              <Eyebrow color={color}>Services</Eyebrow>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">What we do</h2>
            </div>
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
              {services.map((s, i) => {
                const href = serviceHref(site, s);
                const cardClass =
                  "block border-2 border-slate-900 bg-white p-6 text-left transition-transform hover:-translate-y-1 dark:border-white dark:bg-slate-950";
                const inner = (
                  <>
                    <span className="text-sm font-extrabold" style={{ color }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{s.name}</p>
                  </>
                );
                return href ? (
                  <a key={s.id ?? s.slug ?? i} href={href} className={cardClass}>
                    {inner}
                  </a>
                ) : (
                  <div key={s.id ?? s.slug ?? i} className={cardClass}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <Footer site={site} color={color} variant="dark" />
      </div>
    );
  }

  if (site.template === "modern") {
    return (
      <div id="top" className="min-h-screen bg-white dark:bg-slate-950">
        <section className="mx-auto grid max-w-5xl gap-10 px-8 py-24 sm:grid-cols-5 sm:items-center">
          <div className="sm:col-span-3">
            <div className="h-1 w-12 rounded-full" style={{ backgroundColor: color }} />
            <h1 className="mt-5 break-words text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white">
              {site.businessName}
            </h1>
            {site.tagline && <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{site.tagline}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {site.phone && (
                <a
                  href={`tel:${site.phone}`}
                  className="inline-block rounded-lg px-5 py-2.5 font-medium text-white shadow-sm transition-shadow hover:shadow-md"
                  style={{ backgroundColor: color }}
                >
                  Call {site.phone}
                </a>
              )}
              {instagramDmUrl(site.instagramHandle) && (
                <a
                  href={instagramDmUrl(site.instagramHandle)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg border px-5 py-2.5 font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                  style={{ borderColor: color, color }}
                >
                  DM us on Instagram
                </a>
              )}
            </div>
          </div>
          {site.photoUrl && (
            <div className="sm:col-span-2">
              <Photo
                site={site}
                className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-lg"
                sizes="(min-width: 640px) 40vw, 100vw"
              />
            </div>
          )}
        </section>
        {!site.photoUrl && aboutText && (
          <div className="mx-auto max-w-5xl px-8">
            <div className="h-px bg-slate-200 dark:bg-slate-800" />
          </div>
        )}
        <div className="mx-auto max-w-5xl px-8 pb-20 pt-16">
          {aboutText && (
            <div id="about" className="scroll-mt-20 max-w-2xl">
              <Eyebrow color={color}>About</Eyebrow>
              <p className="mt-3 text-lg leading-relaxed text-slate-700 dark:text-slate-300">{aboutText}</p>
            </div>
          )}
          {services.length > 0 && (
            <div id="services" className={`scroll-mt-20 ${aboutText ? "mt-16" : ""}`}>
              <Eyebrow color={color}>Services</Eyebrow>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {services.map((s, i) => {
                  const href = serviceHref(site, s);
                  const cardClass =
                    "block rounded-xl border-t-4 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900";
                  const inner = (
                    <>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{s.name}</p>
                    </>
                  );
                  return href ? (
                    <a key={s.id ?? s.slug ?? i} href={href} className={cardClass} style={{ borderTopColor: color }}>
                      {inner}
                    </a>
                  ) : (
                    <div key={s.id ?? s.slug ?? i} className={cardClass} style={{ borderTopColor: color }}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <Footer site={site} color={color} variant="left" />
      </div>
    );
  }

  // classic (default)
  return (
    <div id="top" className="min-h-screen bg-white font-serif dark:bg-slate-950">
      <section className="px-8 py-28 text-center">
        <h1 className="break-words text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
          {site.businessName}
        </h1>
        <div className="mx-auto mt-5 h-0.5 w-16" style={{ backgroundColor: color }} />
        {site.tagline && <p className="mt-5 text-lg italic text-slate-600 dark:text-slate-300">{site.tagline}</p>}
        {instagramDmUrl(site.instagramHandle) && (
          <a
            href={instagramDmUrl(site.instagramHandle)!}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-widest not-italic transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            style={{ borderColor: color, color }}
          >
            DM on Instagram
          </a>
        )}
      </section>
      <Photo site={site} />
      {aboutText && (
        <section id="about" className="mx-auto max-w-xl scroll-mt-20 px-8 py-16 text-center">
          <Eyebrow color={color}>About Us</Eyebrow>
          <p className="mt-4 text-lg leading-relaxed text-slate-700 dark:text-slate-300">{aboutText}</p>
        </section>
      )}
      {services.length > 0 && (
        <section id="services" className="mx-auto max-w-xl scroll-mt-20 border-t border-slate-200 px-8 py-16 text-center dark:border-slate-800">
          <Eyebrow color={color}>Our Services</Eyebrow>
          <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {services.map((s, i) => {
              const href = serviceHref(site, s);
              return (
                <li key={s.id ?? s.slug ?? i} className="py-3 text-lg text-slate-700 dark:text-slate-300">
                  {href ? (
                    <a href={href} className="underline-offset-4 hover:underline">
                      {s.name}
                    </a>
                  ) : (
                    s.name
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <Footer site={site} color={color} />
    </div>
  );
}

function Footer({
  site,
  color,
  variant = "center",
}: {
  site: SiteData;
  color: string;
  variant?: "center" | "left" | "dark";
}) {
  const dmUrl = instagramDmUrl(site.instagramHandle);
  const year = new Date().getFullYear();
  const ranges = parseHours(site.hours);
  const openNow = ranges ? isOpenNow(ranges) : null;
  const payments = (site.paymentMethods ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const dark = variant === "dark";
  const left = variant === "left";

  return (
    <footer
      id="contact"
      className={`scroll-mt-20 border-t px-8 py-12 text-sm ${
        left ? "text-left" : "text-center"
      } ${
        dark
          ? "border-slate-800 bg-slate-900 text-slate-300"
          : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300"
      }`}
    >
      <div className={left ? "mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-8" : ""}>
        <div>
          {site.address && <p>{site.address}</p>}
          {site.phone && (
            <p>
              <a href={`tel:${site.phone}`} style={{ color: dark ? undefined : color }} className={`font-medium transition-opacity hover:opacity-80 ${dark ? "text-white" : ""}`}>
                {site.phone}
              </a>
            </p>
          )}
          {site.email && (
            <p>
              <a
                href={`mailto:${site.email}`}
                style={{ color: dark ? undefined : color }}
                className={`font-medium transition-opacity hover:opacity-80 ${dark ? "text-white" : ""}`}
              >
                {site.email}
              </a>
            </p>
          )}
          <p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 ${left ? "" : "justify-center"}`}>
            {dmUrl && (
              <a
                href={dmUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: dark ? undefined : color }}
                className={`font-medium transition-opacity hover:opacity-80 ${dark ? "text-white" : ""}`}
              >
                Instagram
              </a>
            )}
            {site.facebookUrl && (
              <a
                href={site.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: dark ? undefined : color }}
                className={`font-medium transition-opacity hover:opacity-80 ${dark ? "text-white" : ""}`}
              >
                Facebook
              </a>
            )}
          </p>
          {site.hours && (
            <p className="mt-2 whitespace-pre-line">
              {site.hours}
              {openNow !== null && (
                <span
                  className={`ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-xs font-medium ${
                    openNow
                      ? "bg-emerald-100 text-emerald-700"
                      : dark
                        ? "bg-slate-800 text-slate-300"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {openNow ? "Open now" : "Closed now"}
                </span>
              )}
            </p>
          )}
          {payments.length > 0 && (
            <p className={`mt-2 text-xs ${dark ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>
              Payment: {payments.join(", ")}
            </p>
          )}
          {site.guaranteeText && (
            <p className="mt-2 text-xs font-medium" style={{ color: dark ? "#fff" : color }}>
              {site.guaranteeText}
            </p>
          )}
        </div>
        <div className={left ? "text-left" : "mt-4"}>
          {site.slug && (
            <p className={`flex gap-3 text-xs ${left ? "" : "justify-center"} ${dark ? "text-slate-400" : "text-slate-400 dark:text-slate-500"}`}>
              <a href={`/s/${site.slug}/privacy`} className="hover:underline">
                Privacy Policy
              </a>
              <a href={`/s/${site.slug}/terms`} className="hover:underline">
                Terms of Service
              </a>
            </p>
          )}
          <p className={`mt-2 text-xs ${dark ? "text-slate-500" : "text-slate-400 dark:text-slate-500"}`}>
            © {year} {site.businessName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
