/**
 * Generic, plain-language legal boilerplate for the generated client sites and
 * for the LaunchLocal app itself.
 *
 * NOT legal advice. This is defensible starting text, not a lawyer's work.
 * See `docs/BRAND-AND-COMPLIANCE-STANDARDS.md` §2.1 and
 * `docs/COMPLIANCE-AUDIT-2026-09.md` (findings F-3, F-4, F-8, F-9).
 *
 * Rules for editing:
 * - Every statement here must stay true of how the sites actually work. If a
 *   data flow changes (a new processor, an analytics script, a new field on the
 *   contact form), update the relevant section in the same change.
 * - No em dashes (house style). Use commas, colons, or a rewrite.
 * - `LEGAL_LAST_UPDATED` is a fixed date, bumped by hand when this text changes,
 *   never `site.updatedAt` (which moves every time the operator edits a page).
 */

/** Bump this by hand whenever the wording below changes. */
export const LEGAL_LAST_UPDATED = new Date("2026-09-06T00:00:00Z");

/** Who runs LaunchLocal, and where to reach them. Shown on every legal page. */
export const LAUNCHLOCAL_OPERATOR = "Frank Sulawa";
export const LAUNCHLOCAL_CONTACT_EMAIL = "Frank.Sulawa@icloud.com";
/** Default governing law for the client-site terms (operator + audience are NY). */
export const LEGAL_GOVERNING_STATE = "New York";

export type LegalSiteInfo = {
  businessName: string;
  email?: string | null;
  address?: string | null;
  /** Present when the site links out to a third-party booking tool. */
  bookingUrl?: string | null;
};

export type LegalSection = { heading: string; body: string; items?: string[] };

function businessContact(site: LegalSiteInfo): string {
  return (
    site.email ||
    site.address ||
    "the contact details on the Contact page of this website"
  );
}

/* ------------------------------------------------------------------ *
 * Client sites
 * ------------------------------------------------------------------ */

export function generatePrivacyPolicy(site: LegalSiteInfo): LegalSection[] {
  const contact = businessContact(site);
  return [
    {
      heading: "Who this policy covers",
      body: `This website presents ${site.businessName}. ${site.businessName} receives and answers the inquiries you send through it. The site is built and hosted by LaunchLocal (${LAUNCHLOCAL_OPERATOR}), which stores and passes on those inquiries on ${site.businessName}'s behalf. This policy explains, in plain language, what information the site handles and why.`,
    },
    {
      heading: "Information you give us",
      body: "If you use the contact form on this site, we collect only what you type into it:",
      items: ["Your name", "Your email address", "The message you write"],
    },
    {
      heading: "Information collected automatically",
      body: "Like almost every website, our hosting provider records basic technical information when a page loads: your IP address, your browser and device type, and the time of the request. This is used to keep the site running and secure. We do not use analytics, advertising, or tracking services, and no third-party scripts run on these pages.",
    },
    {
      heading: "Why we use it",
      body: `We use the information you send only to reply to your inquiry and to provide the services you asked about. We do not sell it, rent it, or share it for advertising. It is shared only with ${site.businessName} (to answer you), with LaunchLocal (as the host that stores the message), and with our infrastructure provider, Vercel, which runs the servers in the United States.`,
    },
    {
      heading: "How long we keep it",
      body: "Contact form messages are kept for up to 24 months so the business can follow up, and are then deleted. Server logs are kept for a short period by the hosting provider and then rotated out.",
    },
    {
      heading: "Your choices",
      body: `You can ask us what information we hold about you, or ask us to delete it, by emailing ${LAUNCHLOCAL_CONTACT_EMAIL} or by contacting ${site.businessName} at ${contact}. We will act on the request within a reasonable time.`,
    },
    {
      heading: "Cookies",
      body: "This site sets no advertising or analytics cookies. It stores a single preference in your browser (whether you chose light or dark mode) so the page looks the same on your next visit. See the Cookie Policy for details.",
    },
    {
      heading: "Children",
      body: "This site is meant for a general audience and is not directed at children under 13. We do not knowingly collect information from children.",
    },
    {
      heading: "Security",
      body: "The site is served over HTTPS and we take reasonable measures to protect the information submitted through it. No method of transmission over the internet is completely secure, so we cannot guarantee absolute security.",
    },
    {
      heading: "Changes",
      body: `We may update this policy from time to time. The date at the top of this page shows when it last changed. Questions can be sent to ${LAUNCHLOCAL_CONTACT_EMAIL}.`,
    },
  ];
}

export function generateTermsOfService(site: LegalSiteInfo): LegalSection[] {
  const contact = businessContact(site);
  const legalName = site.businessName.replace(/\.\s*$/, "");
  return [
    {
      heading: "Acceptance",
      body: `By using this website you agree to these terms. If you do not agree, please do not use the site. This site presents ${legalName} and is built and hosted by LaunchLocal (${LAUNCHLOCAL_OPERATOR}). ${legalName} may update these terms from time to time.`,
    },
    {
      heading: "About the information on this site",
      body: `The content here is provided for general information about ${legalName} and its services. We work to keep it accurate, but prices, hours, availability, and services can change. Nothing on this site is a binding offer. Please confirm current details with ${legalName} directly at ${contact} before relying on them.`,
    },
    {
      heading: "Bookings and payments",
      body: site.bookingUrl
        ? `Appointments booked through the link on this site are handled by a third-party scheduling tool and by ${legalName}. This website does not take payments. Any deposit, cancellation, or refund is governed by ${legalName}'s own policy, summarised on the Cancellation and Refunds page.`
        : `This website does not take bookings or payments. Arrange services with ${legalName} directly using the details on the Contact page.`,
    },
    {
      heading: "Intellectual property",
      body: `The text, images, logos, and design on this site belong to ${legalName} or its licensors, or to LaunchLocal. You may not copy, republish, or reuse them without permission.`,
    },
    {
      heading: "Links to other sites",
      body: "This site may link to third-party websites (for example a booking tool or a social media page). We are not responsible for the content or practices of those sites.",
    },
    {
      heading: "No warranty",
      body: "This site and its content are provided as is, without warranties of any kind, express or implied, to the fullest extent permitted by law.",
    },
    {
      heading: "Limitation of liability",
      body: `To the fullest extent permitted by law, neither ${legalName} nor LaunchLocal is liable for any indirect, incidental, or consequential loss arising from your use of, or inability to use, this website. Some jurisdictions do not allow these limits, in which case they apply to you only as far as the law allows.`,
    },
    {
      heading: "Governing law",
      body: `These terms are governed by the laws of the State of ${LEGAL_GOVERNING_STATE}, without regard to its conflict-of-laws rules.`,
    },
    {
      heading: "Contact",
      body: `Questions about these terms can be sent to ${LAUNCHLOCAL_CONTACT_EMAIL}.`,
    },
  ];
}

export function generateCookiePolicy(site: LegalSiteInfo): LegalSection[] {
  return [
    {
      heading: "The short version",
      body: `This site does not track you. It runs no analytics, no advertising pixels, and no tracking cookies. Because the only thing stored on your device is a setting the site needs to work (see below), there is no cookie consent banner: there is nothing to consent to.`,
    },
    {
      heading: "What is stored on your device",
      body: "One value is saved in your browser's local storage:",
      items: [
        "theme: remembers whether you chose light or dark mode, so the site looks the same next time.",
      ],
    },
    {
      heading: "What is not stored",
      body: `No advertising or analytics cookies. No cross-site tracking. No profiling. The contact form on this site sends your message to ${site.businessName}; it does not set a cookie.`,
    },
    {
      heading: "Clearing it",
      body: "You can clear the stored preference at any time through your browser's settings for this site. The site will simply fall back to your system's light or dark setting.",
    },
    {
      heading: "Changes",
      body: `If this ever changes (for example if a booking widget that sets its own cookies is added), this page will be updated first. Questions: ${LAUNCHLOCAL_CONTACT_EMAIL}.`,
    },
  ];
}

export function generateRefundPolicy(site: LegalSiteInfo): LegalSection[] {
  const legalName = site.businessName.replace(/\.\s*$/, "");
  const contact = businessContact(site);
  return [
    {
      heading: "Cancellations and refunds",
      body: `Bookings, payments, cancellations, and refunds for ${legalName}'s services are handled directly by ${legalName}. This website does not process payments and does not issue refunds.`,
    },
    {
      heading: "How to request one",
      body: `To change or cancel an appointment, or to ask about a refund, contact ${legalName} at ${contact} as early as you can. ${legalName} will apply its own cancellation terms, including any notice period or deposit rules it has told you about at the time of booking.`,
    },
    {
      heading: "Third-party booking tools",
      body: "If you booked through a scheduling tool linked from this site, that tool's own cancellation window and terms also apply.",
    },
  ];
}

/* ------------------------------------------------------------------ *
 * The LaunchLocal app itself
 * ------------------------------------------------------------------ */

export function generateAppPrivacyPolicy(): LegalSection[] {
  return [
    {
      heading: "What LaunchLocal is",
      body: `LaunchLocal is a tool operated by ${LAUNCHLOCAL_OPERATOR} to find local businesses that have no website or a weak one, build them one, and track how it performs. This page explains what information the tool holds.`,
    },
    {
      heading: "Business information from public sources",
      body: "To identify prospects, LaunchLocal retrieves publicly listed business information from the Google Places API: business name, address, phone number, website, and aggregate rating. This is used only to decide which businesses to approach and what to pre-fill on a draft site. It is refreshed or deleted on a rolling 30-day cycle and is never sold or used for advertising.",
    },
    {
      heading: "Messages from the websites we build",
      body: "When a visitor uses the contact form on a site built with LaunchLocal, their name, email, and message are stored so they can be passed to that business. These are kept for up to 24 months and then deleted.",
    },
    {
      heading: "Technical logs",
      body: "Our hosting provider (Vercel, in the United States) records standard request logs (IP address, browser, timestamp) to run and secure the service. These rotate out after a short period.",
    },
    {
      heading: "Your choices",
      body: `If you run a business and want the information LaunchLocal holds about it corrected or removed, email ${LAUNCHLOCAL_CONTACT_EMAIL} and we will act on it within a reasonable time.`,
    },
    {
      heading: "Changes",
      body: `We may update this policy. The date above shows the last change. Contact: ${LAUNCHLOCAL_CONTACT_EMAIL}.`,
    },
  ];
}

export function generateAppTerms(): LegalSection[] {
  return [
    {
      heading: "Operator",
      body: `LaunchLocal is operated by ${LAUNCHLOCAL_OPERATOR}. It is a working tool for LaunchLocal's own prospecting and site-building, not a public service.`,
    },
    {
      heading: "Acceptable use",
      body: "By using this application you agree to use it lawfully and not to disrupt, overload, probe, or attempt to gain unauthorised access to it or its data.",
    },
    {
      heading: "No warranty",
      body: "The application is provided as is, without warranties of any kind, to the fullest extent permitted by law.",
    },
    {
      heading: "Governing law",
      body: `These terms are governed by the laws of the State of ${LEGAL_GOVERNING_STATE}, without regard to its conflict-of-laws rules.`,
    },
    {
      heading: "Contact",
      body: `Questions: ${LAUNCHLOCAL_CONTACT_EMAIL}.`,
    },
  ];
}
