import { db } from "@/lib/db";
import { instagramDmUrl, siteNavLinks } from "@/lib/templates";
import { StickyHeader } from "@/components/site/StickyHeader";
import { BackToTopButton } from "@/components/site/BackToTopButton";
import { FloatingContactButton } from "@/components/site/FloatingContactButton";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";

export default async function PublicSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await db.site.findUnique({ where: { slug } });

  if (!site) return children;

  const color = site.primaryColor || "#2563eb";

  return (
    <>
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <StickyHeader businessName={site.businessName} color={color} navLinks={siteNavLinks(site)} />
      {children}
      <BackToTopButton color={color} />
      <FloatingContactButton phone={site.phone} dmUrl={instagramDmUrl(site.instagramHandle)} color={color} />
      <CookieConsentBanner />
    </>
  );
}
