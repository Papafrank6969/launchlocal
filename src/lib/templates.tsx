import Image from "next/image";
import { parseHours, isOpenNow } from "@/lib/hours";
import { getDesignSystem, deterministicDesignSystem, fontCssValue, type DesignSystem } from "@/lib/designSystems";
import { readableTextColor } from "@/lib/contrast";
import { SiteIdentity } from "@/components/site/SiteFonts";

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
  category?: string | null;
  designSystemId?: string | null;
  slug?: string | null;
  serviceItems?: { id?: string; slug?: string; name: string; description?: string | null }[];
};

export function resolveDesignSystem(site: Pick<SiteData, "businessName" | "category" | "designSystemId">): DesignSystem {
  return site.designSystemId
    ? getDesignSystem(site.designSystemId)
    : deterministicDesignSystem(site.businessName, site.category);
}

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

function serviceHref(site: SiteData, item: { slug?: string }): string | null {
  if (!site.slug || !item.slug) return null;
  return `/s/${site.slug}/services/${item.slug}`;
}

function Eyebrow({ children, color, headingFont }: { children: React.ReactNode; color: string; headingFont: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color, fontFamily: headingFont }}>
      {children}
    </p>
  );
}

export function SitePreview({ site }: { site: SiteData }) {
  const services = site.serviceItems ?? [];
  const system = resolveDesignSystem(site);
  const primary = system.colorPrimary;
  const accent = system.colorAccent;
  const neutralLight = system.colorNeutralLight;
  const primaryText = readableTextColor(primary);
  const headingFont = fontCssValue(system.fontHeading);
  const bodyFont = fontCssValue(system.fontBody);
  const aboutText = site.about || site.story;

  const rootStyle: React.CSSProperties = { fontFamily: bodyFont };
  const headingStyle: React.CSSProperties = { fontFamily: headingFont };

  if (system.heroStyle === "full-bleed") {
    return (
      <div id="top" className="min-h-screen bg-[var(--site-bg)] text-[var(--site-fg)]" style={rootStyle}>
        <SiteIdentity system={system} />
        <section
          className="relative overflow-hidden border-b-4 border-[var(--site-fg)] px-8 py-24 text-center"
          style={{ backgroundColor: primary, color: primaryText }}
        >
          <h1 className="break-words text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl" style={headingStyle}>
            {site.businessName}
          </h1>
          {site.tagline && <p className="mx-auto mt-5 max-w-xl text-xl font-medium opacity-90">{site.tagline}</p>}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {site.phone && (
              <a
                href={`tel:${site.phone}`}
                className="inline-block rounded-md px-7 py-3.5 text-base font-bold shadow-[4px_4px_0_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: neutralLight, color: primary }}
              >
                Call {site.phone}
              </a>
            )}
            {instagramDmUrl(site.instagramHandle) && (
              <a
                href={instagramDmUrl(site.instagramHandle)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md border-2 px-7 py-3.5 text-base font-bold transition-colors hover:bg-white/10"
                style={{ borderColor: primaryText, color: primaryText }}
              >
                DM us on Instagram
              </a>
            )}
          </div>
        </section>
        <Photo site={site} />
        {aboutText && (
          <section id="about" className="mx-auto max-w-3xl scroll-mt-20 px-8 py-20 text-center">
            <Eyebrow color={primary} headingFont={headingFont}>
              About
            </Eyebrow>
            <p className="mt-4 text-2xl font-medium leading-snug">{aboutText}</p>
          </section>
        )}
        {services.length > 0 && (
          <section id="services" className="site-card-bg scroll-mt-20 px-8 py-20">
            <div className="mx-auto max-w-4xl text-center">
              <Eyebrow color={primary} headingFont={headingFont}>
                Services
              </Eyebrow>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight" style={headingStyle}>
                What we do
              </h2>
            </div>
            <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
              {services.map((s, i) => {
                const href = serviceHref(site, s);
                const cardClass = "site-border block border-2 bg-[var(--site-bg)] p-6 text-left transition-transform hover:-translate-y-1";
                const inner = (
                  <>
                    <span className="text-sm font-extrabold" style={{ color: primary }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-2 text-lg font-bold">{s.name}</p>
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
        <Footer site={site} system={system} variant="dark" />
      </div>
    );
  }

  if (system.heroStyle === "split") {
    return (
      <div id="top" className="min-h-screen bg-[var(--site-bg)] text-[var(--site-fg)]" style={rootStyle}>
        <SiteIdentity system={system} />
        <section className="mx-auto grid max-w-5xl gap-10 px-8 py-24 sm:grid-cols-5 sm:items-center">
          <div className="sm:col-span-3">
            <div className="h-1 w-12 rounded-full" style={{ backgroundColor: primary }} />
            <h1 className="mt-5 break-words text-5xl font-bold leading-[1.05] tracking-tight" style={headingStyle}>
              {site.businessName}
            </h1>
            {site.tagline && <p className="mt-4 text-lg opacity-80">{site.tagline}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {site.phone && (
                <a
                  href={`tel:${site.phone}`}
                  className="inline-block rounded-lg px-5 py-2.5 font-medium shadow-sm transition-shadow hover:shadow-md"
                  style={{ backgroundColor: primary, color: primaryText }}
                >
                  Call {site.phone}
                </a>
              )}
              {instagramDmUrl(site.instagramHandle) && (
                <a
                  href={instagramDmUrl(site.instagramHandle)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-border inline-block rounded-lg border px-5 py-2.5 font-medium transition-opacity hover:opacity-80"
                  style={{ color: primary }}
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
        <div className="mx-auto max-w-5xl px-8 pb-20">
          {aboutText && (
            <div id="about" className="scroll-mt-20 max-w-2xl">
              <Eyebrow color={primary} headingFont={headingFont}>
                About
              </Eyebrow>
              <p className="mt-3 text-lg leading-relaxed opacity-90">{aboutText}</p>
            </div>
          )}
          {services.length > 0 && (
            <div id="services" className={`scroll-mt-20 ${aboutText ? "mt-16" : ""}`}>
              <Eyebrow color={primary} headingFont={headingFont}>
                Services
              </Eyebrow>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {services.map((s, i) => {
                  const href = serviceHref(site, s);
                  const cardClass = "site-card-bg block rounded-xl border-t-4 p-5 shadow-sm transition-shadow hover:shadow-md";
                  const inner = (
                    <>
                      <span className="text-xs font-bold opacity-50">{String(i + 1).padStart(2, "0")}</span>
                      <p className="mt-1 font-semibold">{s.name}</p>
                    </>
                  );
                  return href ? (
                    <a key={s.id ?? s.slug ?? i} href={href} className={cardClass} style={{ borderTopColor: accent }}>
                      {inner}
                    </a>
                  ) : (
                    <div key={s.id ?? s.slug ?? i} className={cardClass} style={{ borderTopColor: accent }}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <Footer site={site} system={system} variant="left" />
      </div>
    );
  }

  // centered (default)
  return (
    <div id="top" className="min-h-screen bg-[var(--site-bg)] text-[var(--site-fg)]" style={rootStyle}>
      <SiteIdentity system={system} />
      <section className="px-8 py-28 text-center">
        <h1 className="break-words text-5xl font-bold tracking-tight" style={headingStyle}>
          {site.businessName}
        </h1>
        <div className="mx-auto mt-5 h-0.5 w-16" style={{ backgroundColor: primary }} />
        {site.tagline && <p className="mt-5 text-lg italic opacity-80">{site.tagline}</p>}
        {instagramDmUrl(site.instagramHandle) && (
          <a
            href={instagramDmUrl(site.instagramHandle)!}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ borderColor: primary, color: primary }}
          >
            DM on Instagram
          </a>
        )}
      </section>
      <Photo site={site} />
      {aboutText && (
        <section id="about" className="mx-auto max-w-xl scroll-mt-20 px-8 py-16 text-center">
          <Eyebrow color={primary} headingFont={headingFont}>
            About Us
          </Eyebrow>
          <p className="mt-4 text-lg leading-relaxed opacity-90">{aboutText}</p>
        </section>
      )}
      {services.length > 0 && (
        <section id="services" className="site-border mx-auto max-w-xl scroll-mt-20 border-t px-8 py-16 text-center">
          <Eyebrow color={primary} headingFont={headingFont}>
            Our Services
          </Eyebrow>
          <ul className="site-border mt-4 divide-y">
            {services.map((s, i) => {
              const href = serviceHref(site, s);
              return (
                <li key={s.id ?? s.slug ?? i} className="py-3 text-lg">
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
      <Footer site={site} system={system} />
    </div>
  );
}

function Footer({
  site,
  system,
  variant = "center",
}: {
  site: SiteData;
  system: DesignSystem;
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
  const primary = system.colorPrimary;

  const dark = variant === "dark";
  const left = variant === "left";
  const darkStyle: React.CSSProperties | undefined = dark
    ? { backgroundColor: system.colorNeutralDark, color: system.colorNeutralLight }
    : undefined;

  return (
    <footer
      id="contact"
      className={`site-border scroll-mt-20 border-t px-8 py-12 text-sm ${left ? "text-left" : "text-center"} ${dark ? "" : "opacity-90"}`}
      style={darkStyle}
    >
      <div className={left ? "mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-8" : ""}>
        <div>
          {site.address && <p>{site.address}</p>}
          {site.phone && (
            <p>
              <a href={`tel:${site.phone}`} style={{ color: dark ? undefined : primary }} className="font-medium transition-opacity hover:opacity-80">
                {site.phone}
              </a>
            </p>
          )}
          {site.email && (
            <p>
              <a href={`mailto:${site.email}`} style={{ color: dark ? undefined : primary }} className="font-medium transition-opacity hover:opacity-80">
                {site.email}
              </a>
            </p>
          )}
          <p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 ${left ? "" : "justify-center"}`}>
            {dmUrl && (
              <a href={dmUrl} target="_blank" rel="noopener noreferrer" style={{ color: dark ? undefined : primary }} className="font-medium transition-opacity hover:opacity-80">
                Instagram
              </a>
            )}
            {site.facebookUrl && (
              <a href={site.facebookUrl} target="_blank" rel="noopener noreferrer" style={{ color: dark ? undefined : primary }} className="font-medium transition-opacity hover:opacity-80">
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
                    openNow ? "bg-emerald-100 text-emerald-700" : "site-card-bg"
                  }`}
                >
                  {openNow ? "Open now" : "Closed now"}
                </span>
              )}
            </p>
          )}
          {payments.length > 0 && <p className="mt-2 text-xs opacity-70">Payment: {payments.join(", ")}</p>}
          {site.guaranteeText && (
            <p className="mt-2 text-xs font-medium" style={{ color: dark ? undefined : primary }}>
              {site.guaranteeText}
            </p>
          )}
        </div>
        <div className={left ? "text-left" : "mt-4"}>
          {site.slug && (
            <p className={`flex gap-3 text-xs opacity-60 ${left ? "" : "justify-center"}`}>
              <a href={`/s/${site.slug}/privacy`} className="hover:underline">
                Privacy Policy
              </a>
              <a href={`/s/${site.slug}/terms`} className="hover:underline">
                Terms of Service
              </a>
            </p>
          )}
          <p className="mt-2 text-xs opacity-60">
            © {year} {site.businessName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
