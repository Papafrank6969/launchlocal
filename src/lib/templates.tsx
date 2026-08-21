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

function Photo({ site }: { site: SiteData }) {
  if (!site.photoUrl) return null;
  return (
    <div className="relative h-64 w-full sm:h-96">
      <Image
        src={site.photoUrl}
        alt={site.businessName}
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />
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
  { id: "classic", name: "Classic", description: "Traditional, trustworthy — serif headings, centered hero." },
  { id: "modern", name: "Modern", description: "Clean sans-serif, left-aligned hero, card-based sections." },
  { id: "bold", name: "Bold", description: "Big color block hero, high contrast, punchy CTAs." },
] as const;

function serviceHref(site: SiteData, item: { slug?: string }): string | null {
  if (!site.slug || !item.slug) return null;
  return `/s/${site.slug}/services/${item.slug}`;
}

export function SitePreview({ site }: { site: SiteData }) {
  const services = site.serviceItems ?? [];
  const color = site.primaryColor || "#2563eb";

  if (site.template === "bold") {
    return (
      <div id="top" className="min-h-screen bg-white dark:bg-slate-950">
        <section className="px-8 py-20 text-center text-white" style={{ backgroundColor: color }}>
          <h1 className="break-words text-4xl font-extrabold tracking-tight sm:text-5xl">{site.businessName}</h1>
          {site.tagline && <p className="mt-4 text-xl opacity-90">{site.tagline}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {site.phone && (
              <a
                href={`tel:${site.phone}`}
                className="inline-block rounded-full bg-white px-6 py-3 font-semibold transition-opacity hover:opacity-90"
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
                className="inline-block rounded-full border-2 border-white px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
              >
                DM us on Instagram
              </a>
            )}
          </div>
        </section>
        <Photo site={site} />
        {(site.about || site.story) && (
          <section id="about" className="mx-auto max-w-3xl scroll-mt-20 px-8 py-16 text-center">
            <h2 className="text-2xl font-bold dark:text-white">About Us</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{site.about || site.story}</p>
          </section>
        )}
        {services.length > 0 && (
          <section id="services" className="scroll-mt-20 bg-slate-50 px-8 py-16 dark:bg-slate-900">
            <h2 className="text-center text-2xl font-bold dark:text-white">Services</h2>
            <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
              {services.map((s, i) => {
                const href = serviceHref(site, s);
                const cardClass =
                  "block rounded-lg bg-white p-6 text-center font-medium shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800 dark:text-white";
                return href ? (
                  <a key={s.id ?? s.slug ?? i} href={href} className={cardClass}>
                    {s.name}
                  </a>
                ) : (
                  <div key={s.id ?? s.slug ?? i} className={cardClass}>
                    {s.name}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <Footer site={site} color={color} />
      </div>
    );
  }

  if (site.template === "modern") {
    return (
      <div id="top" className="min-h-screen bg-white dark:bg-slate-950">
        <section className="mx-auto max-w-5xl px-8 py-20">
          <h1 className="break-words text-4xl font-bold text-slate-900 dark:text-white">{site.businessName}</h1>
          {site.tagline && <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">{site.tagline}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {site.phone && (
              <a
                href={`tel:${site.phone}`}
                className="inline-block rounded-md px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
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
                className="inline-block rounded-md border px-5 py-2.5 font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                style={{ borderColor: color, color }}
              >
                DM us on Instagram
              </a>
            )}
          </div>
        </section>
        <Photo site={site} />
        <div className="mx-auto grid max-w-5xl gap-8 px-8 pb-20 sm:grid-cols-2">
          {(site.about || site.story) && (
            <div id="about" className="scroll-mt-20 rounded-xl border border-slate-200 p-6 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">About</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{site.about || site.story}</p>
            </div>
          )}
          {services.length > 0 && (
            <div id="services" className="scroll-mt-20 rounded-xl border border-slate-200 p-6 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">Services</h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {services.map((s, i) => {
                  const href = serviceHref(site, s);
                  return (
                    <li key={s.id ?? s.slug ?? i}>
                      •{" "}
                      {href ? (
                        <a href={href} className="underline-offset-2 hover:underline">
                          {s.name}
                        </a>
                      ) : (
                        s.name
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <Footer site={site} color={color} />
      </div>
    );
  }

  // classic (default)
  return (
    <div id="top" className="min-h-screen bg-white font-serif dark:bg-slate-950">
      <section className="border-b border-slate-200 px-8 py-20 text-center dark:border-slate-800">
        <h1 className="break-words text-4xl font-bold text-slate-900 dark:text-white">{site.businessName}</h1>
        {site.tagline && <p className="mt-3 text-lg italic text-slate-600 dark:text-slate-300">{site.tagline}</p>}
        {instagramDmUrl(site.instagramHandle) && (
          <a
            href={instagramDmUrl(site.instagramHandle)!}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-md border px-5 py-2.5 font-medium not-italic transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
            style={{ borderColor: color, color }}
          >
            DM us on Instagram
          </a>
        )}
      </section>
      <Photo site={site} />
      {(site.about || site.story) && (
        <section id="about" className="mx-auto max-w-2xl scroll-mt-20 px-8 py-14 text-center">
          <h2 className="text-xl font-semibold" style={{ color }}>
            About Us
          </h2>
          <p className="mt-3 text-slate-700 dark:text-slate-300">{site.about || site.story}</p>
        </section>
      )}
      {services.length > 0 && (
        <section id="services" className="mx-auto max-w-2xl scroll-mt-20 px-8 pb-14 text-center">
          <h2 className="text-xl font-semibold" style={{ color }}>
            Our Services
          </h2>
          <ul className="mt-3 space-y-1 text-slate-700 dark:text-slate-300">
            {services.map((s, i) => {
              const href = serviceHref(site, s);
              return (
                <li key={s.id ?? s.slug ?? i}>
                  {href ? (
                    <a href={href} className="underline-offset-2 hover:underline">
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

function Footer({ site, color }: { site: SiteData; color: string }) {
  const dmUrl = instagramDmUrl(site.instagramHandle);
  const year = new Date().getFullYear();
  const ranges = parseHours(site.hours);
  const openNow = ranges ? isOpenNow(ranges) : null;
  const payments = (site.paymentMethods ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <footer
      id="contact"
      className="scroll-mt-20 border-t border-slate-200 px-8 py-10 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300"
    >
      {site.address && <p>{site.address}</p>}
      {site.phone && (
        <p>
          <a href={`tel:${site.phone}`} style={{ color }} className="font-medium transition-opacity hover:opacity-80">
            {site.phone}
          </a>
        </p>
      )}
      {site.email && (
        <p>
          <a
            href={`mailto:${site.email}`}
            style={{ color }}
            className="font-medium transition-opacity hover:opacity-80"
          >
            {site.email}
          </a>
        </p>
      )}
      <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {dmUrl && (
          <a href={dmUrl} target="_blank" rel="noopener noreferrer" style={{ color }} className="font-medium transition-opacity hover:opacity-80">
            Instagram
          </a>
        )}
        {site.facebookUrl && (
          <a
            href={site.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color }}
            className="font-medium transition-opacity hover:opacity-80"
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
                openNow ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {openNow ? "Open now" : "Closed now"}
            </span>
          )}
        </p>
      )}
      {payments.length > 0 && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Payment: {payments.join(", ")}</p>}
      {site.guaranteeText && (
        <p className="mt-2 text-xs font-medium" style={{ color }}>
          {site.guaranteeText}
        </p>
      )}
      {site.slug && (
        <p className="mt-4 flex justify-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <a href={`/s/${site.slug}/privacy`} className="hover:underline">
            Privacy Policy
          </a>
          <a href={`/s/${site.slug}/terms`} className="hover:underline">
            Terms of Service
          </a>
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        © {year} {site.businessName}. All rights reserved.
      </p>
    </footer>
  );
}
