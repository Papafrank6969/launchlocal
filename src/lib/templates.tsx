import Image from "next/image";
import { parseHours, isOpenNow } from "@/lib/hours";
import { getDesignSystem, deterministicDesignSystem, fontCssValue, type DesignSystem } from "@/lib/designSystems";
import { readableTextColor } from "@/lib/contrast";
import { normalizeBookingUrl } from "@/lib/bookingUrl";
import { parseGoogleReviews } from "@/lib/googleReviews";
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
  bookingUrl?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  storyPhotoUrl?: string | null;
  photoAttribution?: string | null;
  guaranteeText?: string | null;
  paymentMethods?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  googleReviewsJson?: string | null;
  googleMapsUrl?: string | null;
  category?: string | null;
  designSystemId?: string | null;
  slug?: string | null;
  serviceItems?: {
    id?: string;
    slug?: string;
    name: string;
    description?: string | null;
    price?: string | null;
    imageUrl?: string | null;
  }[];
};

export function resolveDesignSystem(site: Pick<SiteData, "businessName" | "category" | "designSystemId">): DesignSystem {
  return site.designSystemId
    ? getDesignSystem(site.designSystemId)
    : deterministicDesignSystem(site.businessName, site.category);
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

/** Rating stars read as a rating in every palette when they're gold — the universal convention. */
const STAR_GOLD = "#E0A82E";

function titleCase(s: string): string {
  if (s.toLowerCase() === "hvac contractor") return "HVAC Contractor";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function palette(system: DesignSystem) {
  const primary = system.colorPrimary;
  const headingFont = fontCssValue(system.fontHeading);
  return {
    primary,
    accent: system.colorAccent,
    neutralLight: system.colorNeutralLight,
    primaryText: readableTextColor(primary),
    headingFont,
    headingStyle: { fontFamily: headingFont } as React.CSSProperties,
  };
}

function Eyebrow({ children, color, headingFont }: { children: React.ReactNode; color: string; headingFont: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color, fontFamily: headingFont }}>
      {children}
    </p>
  );
}

/** Real Google rating pulled from the originating lead — never fabricated, and simply absent when there's nothing real to show. */
function RatingBadge({
  rating,
  reviewCount,
  className = "",
}: {
  rating?: number | null;
  reviewCount?: number | null;
  className?: string;
}) {
  if (!rating || !reviewCount) return null;
  return (
    <p className={`inline-flex items-center gap-1.5 text-sm font-medium ${className}`}>
      <svg width="15" height="15" viewBox="0 0 20 20" fill={STAR_GOLD} aria-hidden="true" className="shrink-0">
        <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.8L10 14.9l-5.21 2.62 1-5.8-4.21-4.1 5.82-.85L10 1.5z" />
      </svg>
      <span>
        {rating.toFixed(1)} &middot; {reviewCount.toLocaleString()} Google reviews
      </span>
    </p>
  );
}

export function SitePreview({ site }: { site: SiteData }) {
  const system = resolveDesignSystem(site);
  return (
    <div
      className="min-h-screen bg-[var(--site-bg)] text-[var(--site-fg)]"
      style={{ fontFamily: fontCssValue(system.fontBody) }}
    >
      <SiteIdentity system={system} />
      {system.heroStyle === "full-bleed" ? (
        <HeroFullBleed site={site} system={system} />
      ) : system.heroStyle === "split" ? (
        <HeroSplit site={site} system={system} />
      ) : (
        <HeroCentered site={site} system={system} />
      )}
      <SiteSections site={site} system={system} />
    </div>
  );
}

function HeroImageCard({ src, alt, ratio }: { src: string; alt: string; ratio: string }) {
  return (
    <div className={`relative ${ratio} w-full overflow-hidden rounded-2xl shadow-xl`}>
      <Image src={src} alt={alt} fill className="object-cover" sizes="(min-width: 896px) 896px, 90vw" priority />
    </div>
  );
}

/** Book / Call / DM + a "View services" text link. One primary action, the rest secondary. */
function HeroCtaRow({
  site,
  system,
  shape,
  onDark = false,
  align = "left",
}: {
  site: SiteData;
  system: DesignSystem;
  shape: "block" | "soft" | "pill";
  onDark?: boolean;
  align?: "left" | "center";
}) {
  const { primary, primaryText, neutralLight } = palette(system);
  const bookingUrl = normalizeBookingUrl(site.bookingUrl);
  const dmUrl = instagramDmUrl(site.instagramHandle);
  const services = site.serviceItems ?? [];
  const secondaryHref = services.length > 0 ? "#services" : site.slug ? `/s/${site.slug}/contact` : null;
  const secondaryLabel = services.length > 0 ? "View services" : "Get in touch";

  const base = {
    block: "inline-block rounded-md px-7 py-3.5 text-base font-bold",
    soft: "inline-block rounded-lg px-6 py-3 font-medium",
    pill: "inline-block rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-widest",
  }[shape];
  const fillExtra = {
    block: "shadow-[4px_4px_0_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5",
    soft: "shadow-sm transition-shadow hover:shadow-md",
    pill: "transition-opacity hover:opacity-90",
  }[shape];
  const outlineExtra =
    shape === "block"
      ? `border-2 transition-colors ${onDark ? "hover:bg-white/10" : "hover:bg-black/5"}`
      : "border transition-opacity hover:opacity-80";

  const fillStyle: React.CSSProperties = onDark
    ? { backgroundColor: neutralLight, color: primary }
    : { backgroundColor: primary, color: primaryText };
  const outlineStyle: React.CSSProperties = onDark
    ? { borderColor: primaryText, color: primaryText }
    : { borderColor: primary, color: primary };

  const primaryAction = bookingUrl
    ? { href: bookingUrl, ext: true, label: "Book Now" }
    : site.phone
      ? { href: `tel:${site.phone}`, ext: false, label: `Call ${site.phone}` }
      : null;

  const secondaryButtons: { href: string; ext: boolean; label: string }[] = [];
  if (bookingUrl && site.phone) secondaryButtons.push({ href: `tel:${site.phone}`, ext: false, label: `Call ${site.phone}` });
  if (dmUrl) secondaryButtons.push({ href: dmUrl, ext: true, label: "DM us on Instagram" });

  if (!primaryAction && secondaryButtons.length === 0 && !secondaryHref) return null;

  return (
    <div className={`mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 ${align === "center" ? "justify-center" : ""}`}>
      {primaryAction && (
        <a
          href={primaryAction.href}
          {...(primaryAction.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={`${base} ${fillExtra}`}
          style={fillStyle}
        >
          {primaryAction.label}
        </a>
      )}
      {secondaryButtons.map((b) => (
        <a
          key={b.href}
          href={b.href}
          {...(b.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={`${base} ${outlineExtra}`}
          style={outlineStyle}
        >
          {b.label}
        </a>
      ))}
      {secondaryHref && (
        <a
          href={secondaryHref}
          className="text-sm font-semibold underline-offset-4 hover:underline"
          style={{ color: onDark ? primaryText : primary }}
        >
          {secondaryLabel} &rarr;
        </a>
      )}
    </div>
  );
}

function HeroFullBleed({ site, system }: { site: SiteData; system: DesignSystem }) {
  const { primary, primaryText, headingFont, headingStyle } = palette(system);
  return (
    <>
      <section
        className="relative overflow-hidden border-b-4 border-[var(--site-fg)] px-8 py-14 text-center sm:py-20"
        style={{ backgroundColor: primary, color: primaryText }}
      >
        {site.category && (
          <Eyebrow color={primaryText} headingFont={headingFont}>
            {titleCase(site.category)}
          </Eyebrow>
        )}
        <h1
          className="mt-3 break-words text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl"
          style={headingStyle}
        >
          {site.businessName}
        </h1>
        {site.tagline && <p className="mx-auto mt-5 max-w-xl text-xl font-medium opacity-90">{site.tagline}</p>}
        <RatingBadge rating={site.rating} reviewCount={site.reviewCount} className="mt-4 opacity-90" />
        <div className="flex justify-center">
          <HeroCtaRow site={site} system={system} shape="block" onDark align="center" />
        </div>
      </section>
      {site.photoUrl && (
        <div className="mx-auto -mt-8 max-w-4xl px-8">
          <HeroImageCard src={site.photoUrl} alt={site.businessName} ratio="aspect-[16/9]" />
        </div>
      )}
    </>
  );
}

function HeroSplit({ site, system }: { site: SiteData; system: DesignSystem }) {
  const { primary, headingFont, headingStyle } = palette(system);
  const hasPhoto = Boolean(site.photoUrl);
  return (
    <section
      className={
        hasPhoto
          ? "mx-auto grid max-w-5xl gap-10 px-8 py-14 sm:grid-cols-5 sm:items-center sm:py-20"
          : "mx-auto max-w-5xl px-8 py-14 sm:py-20"
      }
    >
      <div className={hasPhoto ? "sm:col-span-3" : "max-w-2xl"}>
        {site.category ? (
          <Eyebrow color={primary} headingFont={headingFont}>
            {titleCase(site.category)}
          </Eyebrow>
        ) : (
          <div className="h-1 w-12 rounded-full" style={{ backgroundColor: primary }} />
        )}
        <h1 className="mt-4 break-words text-5xl font-bold leading-[1.05] tracking-tight" style={headingStyle}>
          {site.businessName}
        </h1>
        {site.tagline && <p className="mt-4 text-lg opacity-80">{site.tagline}</p>}
        <RatingBadge rating={site.rating} reviewCount={site.reviewCount} className="mt-3 opacity-80" />
        <HeroCtaRow site={site} system={system} shape="soft" align="left" />
      </div>
      {site.photoUrl && (
        <div className="sm:col-span-2">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-lg">
            <Image
              src={site.photoUrl}
              alt={site.businessName}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 40vw, 100vw"
              priority
            />
          </div>
        </div>
      )}
    </section>
  );
}

function HeroCentered({ site, system }: { site: SiteData; system: DesignSystem }) {
  const { primary, headingFont, headingStyle } = palette(system);
  return (
    <>
      <section className="px-8 py-14 text-center sm:py-20">
        {site.category && (
          <Eyebrow color={primary} headingFont={headingFont}>
            {titleCase(site.category)}
          </Eyebrow>
        )}
        <h1 className="mt-3 break-words text-5xl font-bold tracking-tight" style={headingStyle}>
          {site.businessName}
        </h1>
        <div className="mx-auto mt-5 h-0.5 w-16" style={{ backgroundColor: primary }} />
        {site.tagline && <p className="mt-5 text-lg italic opacity-80">{site.tagline}</p>}
        <RatingBadge rating={site.rating} reviewCount={site.reviewCount} className="mt-4 opacity-80" />
        <div className="flex justify-center">
          <HeroCtaRow site={site} system={system} shape="pill" align="center" />
        </div>
      </section>
      {site.photoUrl && (
        <div className="mx-auto max-w-4xl px-8">
          <HeroImageCard src={site.photoUrl} alt={site.businessName} ratio="aspect-[16/9]" />
        </div>
      )}
    </>
  );
}

/** The common tail every site shares, below whichever hero ran. */
function SiteSections({ site, system }: { site: SiteData; system: DesignSystem }) {
  const centered = system.heroStyle !== "split";
  const footerVariant = system.heroStyle === "full-bleed" ? "dark" : system.heroStyle === "split" ? "left" : "center";
  return (
    <>
      <TrustBar site={site} />
      <ServicesSection site={site} system={system} centered={centered} />
      <AboutSection site={site} system={system} centered={centered} />
      <ReviewsSection site={site} system={system} />
      <CtaBanner site={site} system={system} />
      <Footer site={site} system={system} variant={footerVariant} />
    </>
  );
}

/** Rating + a snippet from the top real review, directly under the hero. Never a fabricated quote. */
function TrustBar({ site }: { site: SiteData }) {
  if (!site.rating || !site.reviewCount) return null;
  const top = parseGoogleReviews(site.googleReviewsJson)[0];
  return (
    <section className="site-border site-card-bg border-y px-8 py-4">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ReviewStars rating={Math.round(site.rating)} />
          {site.rating.toFixed(1)}
        </span>
        <span className="opacity-70">{site.reviewCount.toLocaleString()} Google reviews</span>
        {top && (
          <span className="hidden max-w-md truncate opacity-70 md:inline">
            &ldquo;{top.text}&rdquo; &mdash; {top.author}
          </span>
        )}
      </div>
    </section>
  );
}

function ServiceCard({
  site,
  system,
  service,
  bookingUrl,
}: {
  site: SiteData;
  system: DesignSystem;
  service: NonNullable<SiteData["serviceItems"]>[number];
  bookingUrl: string | null;
}) {
  const { primary, primaryText, accent, neutralLight, headingStyle } = palette(system);
  const href = serviceHref(site, service);
  return (
    <div className="site-border flex flex-col overflow-hidden rounded-2xl border bg-[var(--site-bg)] shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ backgroundColor: neutralLight }}>
        {service.imageUrl ? (
          <Image
            src={service.imageUrl}
            alt={service.name}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accent}33, ${primary}1f)` }}
          >
            <span className="text-6xl font-bold opacity-30" style={{ ...headingStyle, color: primary }}>
              {service.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold" style={{ ...headingStyle, color: primary }}>
            {service.name}
          </h3>
          {service.price && <span className="shrink-0 text-sm font-semibold opacity-70">{service.price}</span>}
        </div>
        {service.description && <p className="mt-2 line-clamp-2 text-sm opacity-70">{service.description}</p>}
        <div className="mt-4 flex-1" />
        {bookingUrl ? (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: primary, color: primaryText }}
          >
            Book
          </a>
        ) : href ? (
          <a
            href={href}
            className="site-border self-start rounded-md border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: primary }}
          >
            View details
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ServicesSection({
  site,
  system,
  centered,
}: {
  site: SiteData;
  system: DesignSystem;
  centered: boolean;
}) {
  const services = site.serviceItems ?? [];
  if (services.length === 0) return null;
  const { primary, headingFont, headingStyle } = palette(system);
  const bookingUrl = normalizeBookingUrl(site.bookingUrl);
  return (
    <section id="services" className="site-card-bg scroll-mt-20 px-8 py-16 sm:py-20">
      <div className={`mx-auto max-w-5xl ${centered ? "text-center" : ""}`}>
        <Eyebrow color={primary} headingFont={headingFont}>
          Services
        </Eyebrow>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight" style={headingStyle}>
          What we offer
        </h2>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s, i) => (
          <ServiceCard key={s.id ?? s.slug ?? i} site={site} system={system} service={s} bookingUrl={bookingUrl} />
        ))}
      </div>
    </section>
  );
}

function AboutSection({
  site,
  system,
  centered,
}: {
  site: SiteData;
  system: DesignSystem;
  centered: boolean;
}) {
  const text = site.about || site.story;
  if (!text) return null;
  const { primary, headingFont } = palette(system);
  const img = site.storyPhotoUrl?.trim() || null;

  if (img) {
    return (
      <section id="about" className="scroll-mt-20 px-8 py-16 sm:py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 sm:grid-cols-2">
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl shadow-lg">
            <Image
              src={img}
              alt={site.businessName}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 45vw, 90vw"
            />
          </div>
          <div>
            <Eyebrow color={primary} headingFont={headingFont}>
              About
            </Eyebrow>
            <p className="mt-3 text-lg leading-relaxed opacity-90">{text}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="about"
      className={`mx-auto max-w-2xl scroll-mt-20 px-8 py-16 sm:py-20 ${centered ? "text-center" : ""}`}
    >
      <Eyebrow color={primary} headingFont={headingFont}>
        About
      </Eyebrow>
      <p className="mt-3 text-lg leading-relaxed opacity-90">{text}</p>
    </section>
  );
}

/** The one intentional saturated band — before the footer, never repeated. */
function CtaBanner({ site, system }: { site: SiteData; system: DesignSystem }) {
  const bookingUrl = normalizeBookingUrl(site.bookingUrl);
  if (!bookingUrl && !site.phone) return null;
  const { primary, primaryText, neutralLight, headingStyle } = palette(system);
  const legalName = site.businessName.replace(/\.\s*$/, "");
  return (
    <section className="px-8 py-16 text-center" style={{ backgroundColor: primary, color: primaryText }}>
      <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight" style={headingStyle}>
        Ready to book with {legalName}?
      </h2>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        {bookingUrl && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md px-7 py-3 text-base font-bold transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: neutralLight, color: primary }}
          >
            Book Now
          </a>
        )}
        {site.phone && (
          <a
            href={`tel:${site.phone}`}
            className="inline-block rounded-md border-2 px-7 py-3 text-base font-bold transition-colors hover:bg-white/10"
            style={{ borderColor: primaryText, color: primaryText }}
          >
            Call {site.phone}
          </a>
        )}
      </div>
    </section>
  );
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill={n <= rating ? STAR_GOLD : "currentColor"}
          className={n <= rating ? "" : "opacity-20"}
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.8L10 14.9l-5.21 2.62 1-5.8-4.21-4.1 5.82-.85L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Real Google reviews, verbatim, newest first, with a link back to the Google
 * listing. Renders nothing when there are none — never a placeholder or a
 * fabricated quote (see `docs/SITE-QUALITY-CHECKLIST.md`).
 */
function ReviewsSection({ site, system }: { site: SiteData; system: DesignSystem }) {
  const reviews = parseGoogleReviews(site.googleReviewsJson);
  if (reviews.length === 0) return null;

  const primary = system.colorPrimary;
  const headingFont = fontCssValue(system.fontHeading);
  const mapsUrl = site.googleMapsUrl?.trim() || null;
  // Match the page's alignment — the split hero is left-aligned, the others center.
  const centered = system.heroStyle !== "split";

  return (
    <section id="reviews" className="site-card-bg scroll-mt-20 px-8 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <div className={centered ? "text-center" : ""}>
          <Eyebrow color={primary} headingFont={headingFont}>
            Reviews
          </Eyebrow>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight" style={{ fontFamily: headingFont }}>
            What clients say
          </h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <figure key={i} className="site-border flex flex-col rounded-xl border bg-[var(--site-bg)] p-5 text-left">
              <ReviewStars rating={r.rating} />
              <blockquote className="mt-3 line-clamp-6 text-sm leading-relaxed opacity-90">{r.text}</blockquote>
              <figcaption className="mt-4 text-xs font-medium opacity-70">
                {r.author}
                {r.relativeTime ? ` · ${r.relativeTime}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className={`mt-8 ${centered ? "text-center" : ""}`}>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: primary }}
            >
              Read all reviews on Google →
            </a>
          )}
          <p className="mt-2 text-xs opacity-50">Reviews pulled from Google.</p>
        </div>
      </div>
    </section>
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
  const bookingUrl = normalizeBookingUrl(site.bookingUrl);
  const year = new Date().getFullYear();
  // Business names ending in "Co." / "LLC." shouldn't render "Name.. All rights reserved."
  const legalName = site.businessName.replace(/\.\s*$/, "");
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
          {bookingUrl && (
            <p>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: dark ? undefined : primary }}
                className="font-semibold transition-opacity hover:opacity-80"
              >
                Book an appointment
              </a>
            </p>
          )}
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
            © {year} {legalName}. All rights reserved.
          </p>
          {site.photoAttribution && <p className="mt-1 text-xs opacity-50">{site.photoAttribution}</p>}
        </div>
      </div>
    </footer>
  );
}
