// Adding or revising a system here: follow `docs/DESIGN-PROCESS.md` §1 — query
// the ui-ux-pro-max skill for palette + font-pairing candidates, hand-build the
// 4-role color system, then WCAG-gate it (`npm test` covers the whole list).

export type HeroStyle = "centered" | "split" | "full-bleed";

export type FontChoice = { family: string; weight: string; fallback: "serif" | "sans-serif" };

export type DesignSystem = {
  id: string;
  name: string;
  mood: string;
  categories: string[];
  fontHeading: FontChoice;
  fontBody: FontChoice;
  colorPrimary: string;
  colorAccent: string;
  colorNeutralDark: string;
  colorNeutralLight: string;
  heroStyle: HeroStyle;
};

export const DESIGN_SYSTEMS: DesignSystem[] = [
  {
    id: "warm-editorial",
    name: "Warm Editorial",
    mood: "Warm, inviting, hand-crafted — for food, florists, and hospitality businesses.",
    categories: [
      "bakery",
      "cafe",
      "coffee shop",
      "restaurant",
      "florist",
      "caterer",
      "deli",
      "bistro",
      "pizzeria",
      "ice cream shop",
      "juice bar",
      "bookstore",
    ],
    fontHeading: { family: "Fraunces", weight: "600", fallback: "serif" },
    fontBody: { family: "Work Sans", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#A34F27",
    colorAccent: "#A6741F",
    colorNeutralDark: "#3B2A21",
    colorNeutralLight: "#FBF3EA",
    heroStyle: "centered",
  },
  {
    id: "sharp-corporate",
    name: "Sharp Corporate",
    mood: "Serious, established, trustworthy — for law, finance, and professional services.",
    categories: [
      "law firm",
      "accounting",
      "financial",
      "consulting",
      "insurance",
      "notary",
      "bookkeeping",
      "tax preparation",
      "financial advisor",
      "title company",
    ],
    fontHeading: { family: "Newsreader", weight: "600", fallback: "serif" },
    fontBody: { family: "Source Sans 3", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#1E3A5F",
    colorAccent: "#7A8B99",
    colorNeutralDark: "#16232E",
    colorNeutralLight: "#F4F6F8",
    heroStyle: "centered",
  },
  {
    id: "natural-organic",
    name: "Natural Organic",
    mood: "Grounded, outdoorsy, photo-forward — for landscaping, gardening, and outdoor trades.",
    categories: [
      "landscaping",
      "gardening",
      "lawn care",
      "nursery",
      "farm",
      "tree service",
      "arborist",
      "pool service",
      "garden center",
      "hardscaping",
      "irrigation",
    ],
    fontHeading: { family: "DM Serif Display", weight: "400", fallback: "serif" },
    fontBody: { family: "Mulish", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#2F5233",
    colorAccent: "#8F6A1E",
    colorNeutralDark: "#1F2E22",
    colorNeutralLight: "#F5F3EA",
    heroStyle: "split",
  },
  {
    id: "playful-bold",
    name: "Playful Bold",
    mood: "Energetic, punchy, high-contrast — for fitness, events, and youth-facing businesses.",
    categories: [
      "gym",
      "fitness",
      "event",
      "party",
      "food truck",
      "kids",
      "yoga studio",
      "yoga",
      "pilates",
      "martial arts",
      "dance studio",
      "dance",
      "climbing gym",
      "personal trainer",
      "crossfit",
    ],
    fontHeading: { family: "Poppins", weight: "700", fallback: "sans-serif" },
    fontBody: { family: "Inter", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#C13F1A",
    colorAccent: "#0E7C7B",
    colorNeutralDark: "#201A17",
    colorNeutralLight: "#FFF8F3",
    heroStyle: "full-bleed",
  },
  {
    id: "minimal-luxury",
    name: "Minimal Luxury",
    mood: "Restrained, elegant, quiet confidence — for salons, spas, and boutique retail.",
    categories: [
      "salon",
      "spa",
      "jewelry",
      "boutique",
      "beauty",
      "tailor",
      "alterations",
      "waxing",
      "med spa",
      "day spa",
      "massage therapy",
      "acupuncture",
      "wedding planner",
    ],
    fontHeading: { family: "Cormorant Garamond", weight: "600", fallback: "serif" },
    fontBody: { family: "Karla", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#1A1A1A",
    colorAccent: "#A9824B",
    colorNeutralDark: "#1A1A1A",
    colorNeutralLight: "#F7F4EF",
    heroStyle: "centered",
  },
  {
    id: "studio-beauty",
    name: "Studio Beauty",
    mood: "Soft, modern, portfolio-first — for lash, nail, and brow technicians who sell on their photos.",
    categories: [
      "nail technician",
      "nail salon",
      "nail tech",
      "lash technician",
      "lash tech",
      "eyelash technician",
      "lash artist",
      "brow technician",
      "brow artist",
      "microblading",
      "permanent makeup",
      "lash lift",
      "tattoo",
      "tattoo shop",
      "tattoo artist",
    ],
    fontHeading: { family: "Bodoni Moda", weight: "600", fallback: "serif" },
    fontBody: { family: "Inter", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#2B2320",
    colorAccent: "#AE7680",
    colorNeutralDark: "#211B19",
    colorNeutralLight: "#FBF3F0",
    heroStyle: "split",
  },
  {
    id: "technical-precision",
    name: "Technical Precision",
    mood: "Confident, no-nonsense, utilitarian — for trades and technical contractors.",
    categories: [
      "auto repair",
      "hvac contractor",
      "plumber",
      "electrician",
      "contractor",
      "mechanic",
      "roofer",
      "roofing",
      "painter",
      "painting",
      "locksmith",
      "movers",
      "moving company",
      "handyman",
      "pest control",
      "cleaning service",
      "house cleaning",
      "garage door",
      "fence contractor",
      "flooring",
      "gutter",
      "pressure washing",
      "junk removal",
      "appliance repair",
      "window installation",
      "siding",
    ],
    fontHeading: { family: "Oswald", weight: "600", fallback: "sans-serif" },
    fontBody: { family: "Barlow", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#22548C",
    colorAccent: "#C1571F",
    colorNeutralDark: "#1C1F22",
    colorNeutralLight: "#F2F3F5",
    heroStyle: "full-bleed",
  },
  {
    id: "friendly-approachable",
    name: "Friendly Approachable",
    mood: "Soft, reassuring, easy to trust — for healthcare, family, and pet services.",
    categories: [
      "dentist",
      "pediatric",
      "veterinary",
      "family services",
      "clinic",
      "hair salon",
      "barber",
      "barbershop",
      "chiropractor",
      "physical therapy",
      "physical therapist",
      "optometrist",
      "eye care",
      "pet grooming",
      "dog grooming",
      "child care",
      "childcare",
      "daycare",
      "day care",
      "preschool",
      "orthodontist",
      "urgent care",
    ],
    fontHeading: { family: "Quicksand", weight: "600", fallback: "sans-serif" },
    fontBody: { family: "Nunito", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#2F72B8",
    colorAccent: "#2E9E86",
    colorNeutralDark: "#26333D",
    colorNeutralLight: "#F1F7FC",
    heroStyle: "split",
  },
  {
    id: "crafted-artisan",
    name: "Crafted Artisan",
    mood: "Handmade, textured, small-batch — for makers, brewers, and craft goods.",
    categories: [
      "brewery",
      "woodworking",
      "pottery",
      "handmade",
      "craft",
      "bakery",
      "print shop",
      "printing",
      "screen printing",
      "letterpress",
      "sign shop",
      "picture framing",
      "shoe repair",
      "upholstery",
      "distillery",
      "coffee roaster",
      "chocolatier",
      "candle maker",
      "soap maker",
      "leather goods",
    ],
    fontHeading: { family: "Zilla Slab", weight: "600", fallback: "serif" },
    fontBody: { family: "Karla", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#7A3A1D",
    colorAccent: "#8A6620",
    colorNeutralDark: "#2B1D14",
    colorNeutralLight: "#FAF3E9",
    heroStyle: "centered",
  },
  {
    id: "gilded-atelier",
    name: "Gilded Atelier",
    mood: "Editorial, precious, unhurried — for fine jewelry and luxury goods makers.",
    categories: [
      "fine jewelry",
      "jeweler",
      "luxury goods",
      "atelier",
      "watch repair",
      "watchmaker",
      "goldsmith",
      "custom jewelry",
    ],
    fontHeading: { family: "Playfair Display", weight: "600", fallback: "serif" },
    fontBody: { family: "Inter", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#2B241C",
    colorAccent: "#A9822F",
    colorNeutralDark: "#1B1814",
    colorNeutralLight: "#FAF7F2",
    heroStyle: "split",
  },
  {
    id: "midnight-dining",
    name: "Midnight Dining",
    mood: "Dark, intimate, confident — for fine dining, wine bars, and upscale hospitality.",
    categories: [
      "fine dining",
      "upscale restaurant",
      "wine bar",
      "steakhouse",
      "tasting menu",
      "cocktail bar",
      "cocktail lounge",
      "speakeasy",
      "supper club",
      "champagne bar",
    ],
    fontHeading: { family: "Fraunces", weight: "500", fallback: "serif" },
    fontBody: { family: "Manrope", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#2F4A3C",
    colorAccent: "#C9A24B",
    colorNeutralDark: "#0C0C0B",
    colorNeutralLight: "#F3EDE1",
    heroStyle: "full-bleed",
  },
  {
    id: "considered-modern",
    name: "Considered Modern",
    mood: "Grounded, professional, warm-neutral — for real estate, interior design, and home services.",
    categories: [
      "real estate",
      "realtor",
      "interior design",
      "interior designer",
      "home staging",
      "architect",
      "architecture firm",
      "photographer",
      "photography",
      "photography studio",
      "property management",
      "home inspection",
      "home inspector",
    ],
    fontHeading: { family: "Libre Caslon Text", weight: "400", fallback: "serif" },
    fontBody: { family: "Jost", weight: "400", fallback: "sans-serif" },
    colorPrimary: "#1C2B3A",
    colorAccent: "#B5765A",
    colorNeutralDark: "#1C2B3A",
    colorNeutralLight: "#F7F5F0",
    heroStyle: "split",
  },
];

export const DEFAULT_DESIGN_SYSTEM_ID = "sharp-corporate";

export function getDesignSystem(id?: string | null): DesignSystem {
  return DESIGN_SYSTEMS.find((s) => s.id === id) ?? DESIGN_SYSTEMS.find((s) => s.id === DEFAULT_DESIGN_SYSTEM_ID)!;
}

/** Deterministic fallback pick when no AI call is available — same business always gets the same result. */
export function deterministicDesignSystem(businessName: string, category?: string | null): DesignSystem {
  if (category) {
    const cat = category.toLowerCase().trim();
    // Exact category match first (e.g. "hair salon" should hit its own literal
    // entry, not get shadowed by a shorter substring like "salon" earlier in
    // the list) — only fall back to substring matching if nothing matches exactly.
    const exact = DESIGN_SYSTEMS.find((s) => s.categories.includes(cat));
    if (exact) return exact;
    const partial = DESIGN_SYSTEMS.find((s) => s.categories.some((c) => cat.includes(c)));
    if (partial) return partial;
  }

  let hash = 0;
  const seed = `${businessName}:${category ?? ""}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return DESIGN_SYSTEMS[hash % DESIGN_SYSTEMS.length];
}

export function fontCssValue(font: FontChoice): string {
  return `'${font.family}', ${font.fallback}`;
}

export function googleFontsHref(system: DesignSystem): string {
  const spec = (font: FontChoice) => `family=${font.family.replace(/ /g, "+")}:wght@${font.weight}`;
  return `https://fonts.googleapis.com/css2?${spec(system.fontHeading)}&${spec(system.fontBody)}&display=swap`;
}
