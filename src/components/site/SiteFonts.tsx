import { preconnect } from "react-dom";
import { googleFontsHref, fontCssValue, type DesignSystem } from "@/lib/designSystems";
import { AsyncGoogleFont } from "@/components/site/AsyncGoogleFont";

/**
 * Loads the design system's Google Font pairing and defines the CSS custom
 * properties every site page renders through: --site-bg/--site-fg swap
 * between the system's light and dark neutrals when the .dark class is
 * present on <html>; --site-card-bg and --site-border are derived tints so
 * cards/dividers stay in the same palette automatically in both modes.
 *
 * The font stylesheet loads asynchronously (see AsyncGoogleFont) so it never
 * blocks first paint — see that file for why. The <style> tag with the CSS
 * vars is cheap/inline and safe to render synchronously; React 19 hoists it
 * into <head> and re-rendering it (e.g. home page's layout + content) is
 * harmless since the content is identical.
 */
export function SiteIdentity({ system }: { system: DesignSystem }) {
  preconnect("https://fonts.googleapis.com");
  preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });

  return (
    <>
      <AsyncGoogleFont href={googleFontsHref(system)} />
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
