export type SiteNavFlags = {
  hasAbout: boolean;
  hasServices: boolean;
  hasBlogPosts: boolean;
  hasGalleryItems: boolean;
  hasFaqItems: boolean;
};

export function buildSiteNav(slug: string, flags: SiteNavFlags): { href: string; label: string }[] {
  const base = `/s/${slug}`;
  const links = [{ href: base, label: "Home" }];
  if (flags.hasAbout) links.push({ href: `${base}/about`, label: "About" });
  if (flags.hasServices) links.push({ href: `${base}/services`, label: "Services" });
  if (flags.hasBlogPosts) links.push({ href: `${base}/blog`, label: "Blog" });
  if (flags.hasGalleryItems) links.push({ href: `${base}/gallery`, label: "Gallery" });
  if (flags.hasFaqItems) links.push({ href: `${base}/faq`, label: "FAQ" });
  links.push({ href: `${base}/contact`, label: "Contact" });
  return links;
}
