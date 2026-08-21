import { db } from "@/lib/db";
import { instagramDmUrl, resolveDesignSystem } from "@/lib/templates";
import { buildSiteNav } from "@/lib/siteNav";
import { StickyHeader } from "@/components/site/StickyHeader";
import { BackToTopButton } from "@/components/site/BackToTopButton";
import { FloatingContactButton } from "@/components/site/FloatingContactButton";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";
import { SiteIdentity } from "@/components/site/SiteFonts";

export default async function PublicSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await db.site.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          serviceItems: true,
          galleryItems: true,
          faqItems: true,
          blogPosts: { where: { published: true } },
        },
      },
    },
  });

  if (!site) return children;

  const system = resolveDesignSystem(site);
  const color = system.colorPrimary;
  const navLinks = buildSiteNav(slug, {
    hasAbout: Boolean(site.story || site.about),
    hasServices: site._count.serviceItems > 0,
    hasBlogPosts: site._count.blogPosts > 0,
    hasGalleryItems: site._count.galleryItems > 0,
    hasFaqItems: site._count.faqItems > 0,
  });

  return (
    <>
      <SiteIdentity system={system} />
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <StickyHeader businessName={site.businessName} color={color} homeHref={`/s/${slug}`} navLinks={navLinks} />
      <main id="top">{children}</main>
      <BackToTopButton color={color} />
      <FloatingContactButton phone={site.phone} dmUrl={instagramDmUrl(site.instagramHandle)} color={color} />
      <CookieConsentBanner />
    </>
  );
}
