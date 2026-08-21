import { googleFontsHref, fontCssValue, type DesignSystem } from "@/lib/designSystems";

/**
 * Loads the design system's Google Font pairing and defines the CSS custom
 * properties every site page renders through: --site-bg/--site-fg swap
 * between the system's light and dark neutrals when the .dark class is
 * present on <html>; --site-card-bg and --site-border are derived tints so
 * cards/dividers stay in the same palette automatically in both modes.
 *
 * React 19 hoists <link>/<style> tags rendered anywhere in the tree into
 * <head> and dedupes <link rel="stylesheet"> by href, so this is safe to
 * render from both the public site pages and the admin live preview
 * (rendering it twice on the same page, e.g. home page's layout + content,
 * is harmless — last <style> wins with identical content).
 */
export function SiteIdentity({ system }: { system: DesignSystem }) {
  return (
    <>
      <link rel="stylesheet" href={googleFontsHref(system)} precedence="default" />
      <style>{`
        :root {
          --site-bg: ${system.colorNeutralLight};
          --site-fg: ${system.colorNeutralDark};
          --site-font-heading: ${fontCssValue(system.fontHeading)};
          --site-font-body: ${fontCssValue(system.fontBody)};
        }
        .dark {
          --site-bg: ${system.colorNeutralDark};
          --site-fg: ${system.colorNeutralLight};
        }
        .site-card-bg { background-color: color-mix(in srgb, var(--site-bg) 92%, var(--site-fg) 8%); }
        .site-border { border-color: color-mix(in srgb, var(--site-fg) 15%, transparent); }
      `}</style>
    </>
  );
}
