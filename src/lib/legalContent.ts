export type LegalSiteInfo = {
  businessName: string;
  email?: string | null;
  address?: string | null;
};

export function generatePrivacyPolicy(site: LegalSiteInfo): { heading: string; body: string }[] {
  const contact = site.email || site.address || "the contact details on this site";
  return [
    {
      heading: "Overview",
      body: `${site.businessName} ("we", "us") respects your privacy. This page explains, in plain language, what information we collect through this website and how we use it.`,
    },
    {
      heading: "Information we collect",
      body: "If you contact us through a form on this site, we collect the information you provide — typically your name, email address, and message. We don't sell or share this information with third parties.",
    },
    {
      heading: "How we use it",
      body: "We use the information you send us only to respond to your inquiry and provide the services you've asked about.",
    },
    {
      heading: "Contact us",
      body: `Questions about this policy can be sent to ${contact}.`,
    },
  ];
}

export function generateTermsOfService(site: LegalSiteInfo): { heading: string; body: string }[] {
  const contact = site.email || site.address || "the contact details on this site";
  return [
    {
      heading: "Agreement",
      body: `By using this website, you agree to these terms. If you don't agree, please don't use the site. ${site.businessName} may update this page from time to time.`,
    },
    {
      heading: "Use of this site",
      body: "This website is provided for informational purposes about our services. Content on this site may not be copied or reused without permission.",
    },
    {
      heading: "No warranty",
      body: "This site and its content are provided as-is, without warranties of any kind, to the extent permitted by law.",
    },
    {
      heading: "Contact us",
      body: `Questions about these terms can be sent to ${contact}.`,
    },
  ];
}
