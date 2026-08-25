type ServiceSuggestionGroup = { categories: string[]; services: string[] };

/**
 * Curated, category-typical service names an operator can one-click add to a
 * site — never business-specific claims, just what businesses in that trade
 * commonly offer. Same exact-then-substring category matching as
 * deterministicDesignSystem in designSystems.ts. Covers every category used
 * there, plus additional common small-business categories not tied to any
 * design system.
 */
const SERVICE_SUGGESTIONS: ServiceSuggestionGroup[] = [
  {
    categories: ["bakery"],
    services: ["Custom cakes", "Fresh bread & pastries", "Catering trays", "Custom cookies", "Gluten-free options"],
  },
  {
    categories: ["cafe", "coffee shop"],
    services: [
      "Espresso & coffee",
      "Pastries & baked goods",
      "Catering & office orders",
      "Private events",
      "Grab-and-go breakfast",
    ],
  },
  {
    categories: ["restaurant"],
    services: ["Dine-in", "Takeout & delivery", "Private events & catering", "Happy hour", "Reservations"],
  },
  {
    categories: ["florist"],
    services: [
      "Custom arrangements",
      "Wedding & event florals",
      "Same-day delivery",
      "Subscription bouquets",
      "Corporate accounts",
    ],
  },
  {
    categories: ["caterer"],
    services: ["Weddings", "Corporate events", "Private parties", "Menu tastings", "Drop-off catering"],
  },
  {
    categories: ["law firm"],
    services: ["Consultations", "Litigation", "Contract review", "Estate planning", "Business formation"],
  },
  {
    categories: ["accounting"],
    services: ["Tax preparation", "Bookkeeping", "Payroll services", "Audit support", "Financial statements"],
  },
  {
    categories: ["financial"],
    services: [
      "Financial planning",
      "Retirement planning",
      "Investment management",
      "Tax strategy",
      "College savings planning",
    ],
  },
  {
    categories: ["consulting"],
    services: ["Strategy consulting", "Process improvement", "Market research", "Ongoing advisory", "Workshops & training"],
  },
  {
    categories: ["insurance"],
    services: ["Auto insurance", "Home insurance", "Life insurance", "Policy review", "Claims assistance"],
  },
  {
    categories: ["landscaping"],
    services: ["Lawn maintenance", "Landscape design", "Irrigation installation", "Seasonal cleanup", "Hardscaping"],
  },
  {
    categories: ["gardening", "nursery"],
    services: [
      "Plant selection",
      "Garden design",
      "Planting & installation",
      "Seasonal maintenance",
      "Delivery & installation",
    ],
  },
  {
    categories: ["lawn care"],
    services: ["Mowing & edging", "Fertilization", "Weed control", "Aeration & seeding", "Leaf removal"],
  },
  {
    categories: ["farm"],
    services: ["Farm-fresh produce", "CSA subscriptions", "Farm stand", "Wholesale orders", "U-pick events"],
  },
  {
    categories: ["gym", "fitness"],
    services: ["Personal training", "Group classes", "Nutrition coaching", "Membership plans", "Open gym access"],
  },
  {
    categories: ["event", "party"],
    services: ["Event planning", "Venue rental", "Party packages", "Day-of coordination", "Rentals & equipment"],
  },
  {
    categories: ["food truck"],
    services: ["Catering bookings", "Private events", "Daily menu", "Custom orders", "Festivals & markets"],
  },
  {
    categories: ["kids"],
    services: ["Birthday parties", "Classes & camps", "Open play", "Group bookings", "After-school programs"],
  },
  {
    categories: ["nail technician", "nail salon", "nail tech"],
    services: ["Manicures", "Pedicures", "Gel & dip powder", "Nail art", "Acrylic fills"],
  },
  {
    categories: ["lash technician", "lash tech", "eyelash technician", "lash artist"],
    services: ["Classic lash extensions", "Volume lash extensions", "Lash lifts & tints", "Lash fills", "Lash removal"],
  },
  {
    categories: ["brow technician", "brow artist", "microblading"],
    services: ["Microblading", "Brow lamination", "Brow tinting", "Brow waxing & threading", "Ombre powder brows"],
  },
  {
    categories: ["salon", "hair salon"],
    services: ["Haircuts & styling", "Color & highlights", "Blowouts", "Bridal styling", "Extensions"],
  },
  {
    categories: ["spa"],
    services: ["Massage therapy", "Facials", "Body treatments", "Spa packages", "Memberships"],
  },
  {
    categories: ["boutique"],
    services: ["Personal styling", "New arrivals", "Gift wrapping", "Custom orders", "Personal shopping appointments"],
  },
  {
    categories: ["beauty"],
    services: [
      "Makeup application",
      "Skincare consultations",
      "Lash & brow services",
      "Product recommendations",
      "Bridal packages",
    ],
  },
  {
    categories: ["jewelry"],
    services: ["Custom design", "Repairs & resizing", "Cleaning & inspection", "Appraisals", "Watch battery replacement"],
  },
  {
    categories: ["auto repair", "mechanic"],
    services: ["Oil changes", "Brake service", "Engine diagnostics", "State inspection", "Tire service"],
  },
  {
    categories: ["hvac contractor"],
    services: ["AC repair", "Heating repair", "System installation", "Maintenance plans", "Duct cleaning"],
  },
  {
    categories: ["plumber"],
    services: ["Drain cleaning", "Water heater repair", "Leak detection", "Repiping", "Fixture installation"],
  },
  {
    categories: ["electrician"],
    services: [
      "Panel upgrades",
      "Wiring & rewiring",
      "Lighting installation",
      "Emergency service",
      "EV charger installation",
    ],
  },
  {
    categories: ["contractor"],
    services: [
      "Home renovations",
      "Additions",
      "Kitchen & bath remodels",
      "Project management",
      "Permitting & inspections",
    ],
  },
  {
    categories: ["dentist"],
    services: ["Cleanings & checkups", "Cosmetic dentistry", "Teeth whitening", "Emergency dental care", "Dental implants"],
  },
  {
    categories: ["pediatric"],
    services: ["Well-child visits", "Vaccinations", "Sick visits", "Developmental screenings", "Sports physicals"],
  },
  {
    categories: ["veterinary"],
    services: ["Wellness exams", "Vaccinations", "Dental care", "Surgery", "Boarding"],
  },
  {
    categories: ["family services"],
    services: ["Counseling", "Family mediation", "Support groups", "Referral services", "Parenting classes"],
  },
  {
    categories: ["clinic"],
    services: ["Primary care", "Preventive screenings", "Same-day appointments", "Lab testing", "Chronic care management"],
  },
  {
    categories: ["brewery"],
    services: ["Tastings & flights", "Growler fills", "Private events", "Brewery tours", "Merchandise"],
  },
  {
    categories: ["woodworking"],
    services: ["Custom furniture", "Restoration", "Commissioned pieces", "Repairs", "Custom cabinetry"],
  },
  {
    categories: ["pottery"],
    services: ["Custom pieces", "Classes & workshops", "Wedding registries", "Wholesale orders", "Studio memberships"],
  },
  {
    categories: ["handmade", "craft"],
    services: ["Custom orders", "Workshops", "Wholesale inquiries", "Gift sets", "Seasonal markets"],
  },
  {
    categories: ["fine jewelry", "jeweler", "luxury goods", "atelier"],
    services: ["Custom design", "Engagement rings", "Repairs & restoration", "Appraisals", "Watch service"],
  },
  {
    categories: ["fine dining", "upscale restaurant", "wine bar", "steakhouse", "tasting menu"],
    services: ["Tasting menu", "Wine pairings", "Private dining", "Chef's table", "Sommelier-led tastings"],
  },
  {
    categories: ["real estate", "realtor"],
    services: [
      "Buyer representation",
      "Seller representation",
      "Market analysis",
      "Relocation services",
      "Property management",
    ],
  },
  {
    categories: ["interior design", "interior designer"],
    services: [
      "Full-service design",
      "Space planning",
      "Furniture selection",
      "Styling & staging",
      "Virtual design consultations",
    ],
  },
  {
    categories: ["home staging"],
    services: ["Vacant staging", "Occupied staging", "Design consultation", "Photography prep", "Furniture rental"],
  },
  {
    categories: ["barber", "barbershop"],
    services: ["Haircuts", "Beard trims", "Hot towel shaves", "Kids' cuts", "Walk-ins welcome"],
  },
  {
    categories: ["photographer", "photography"],
    services: ["Portrait sessions", "Wedding photography", "Event coverage", "Photo editing", "Prints & albums"],
  },
  {
    categories: ["wedding planner"],
    services: [
      "Full wedding planning",
      "Day-of coordination",
      "Vendor management",
      "Budget planning",
      "Venue scouting",
    ],
  },
  {
    categories: ["moving company", "movers"],
    services: ["Local moves", "Long-distance moves", "Packing services", "Furniture assembly", "Storage solutions"],
  },
  {
    categories: ["cleaning service", "house cleaning"],
    services: [
      "Recurring cleaning",
      "Deep cleaning",
      "Move-in/move-out cleaning",
      "Office cleaning",
      "Green cleaning options",
    ],
  },
  {
    categories: ["pest control"],
    services: ["General pest control", "Termite treatment", "Rodent control", "Mosquito treatment", "Preventive plans"],
  },
  {
    categories: ["roofing", "roofer"],
    services: ["Roof repair", "Roof replacement", "Roof inspections", "Storm damage repair", "Gutter installation"],
  },
  {
    categories: ["painting", "painter"],
    services: ["Interior painting", "Exterior painting", "Cabinet refinishing", "Pressure washing", "Color consultations"],
  },
  {
    categories: ["locksmith"],
    services: ["Lock installation", "Lockout service", "Key duplication", "Rekeying", "Smart lock installation"],
  },
  {
    categories: ["daycare", "child care"],
    services: ["Full-day care", "Part-time care", "Infant care", "After-school care", "Summer programs"],
  },
  {
    categories: ["yoga studio"],
    services: ["Group classes", "Private sessions", "Workshops", "Teacher training", "Class packages"],
  },
  {
    categories: ["martial arts"],
    services: ["Kids' classes", "Adult classes", "Belt testing", "Self-defense workshops", "Summer camps"],
  },
  {
    categories: ["chiropractor"],
    services: ["Spinal adjustments", "Sports injury treatment", "Posture correction", "Prenatal care", "Wellness plans"],
  },
  {
    categories: ["physical therapy"],
    services: [
      "Injury rehabilitation",
      "Post-surgical therapy",
      "Sports therapy",
      "Balance & mobility training",
      "Custom treatment plans",
    ],
  },
  {
    categories: ["optometrist", "eye care"],
    services: ["Eye exams", "Contact lens fittings", "Glasses & frames", "Pediatric eye care", "Vision therapy"],
  },
  {
    categories: ["tattoo", "tattoo shop"],
    services: ["Custom tattoos", "Flash tattoos", "Cover-ups", "Piercings", "Consultations"],
  },
  {
    categories: ["tailor", "alterations"],
    services: ["Alterations", "Custom tailoring", "Wedding dress fitting", "Suit fitting", "Repairs"],
  },
  {
    categories: ["pet grooming"],
    services: ["Bathing & brushing", "Haircuts & styling", "Nail trimming", "Teeth cleaning", "Flea treatment"],
  },
  {
    categories: ["bookstore"],
    services: ["New releases", "Used books", "Special orders", "Author events", "Book clubs"],
  },
  {
    categories: ["print shop", "printing"],
    services: ["Business cards", "Banners & signs", "Copies & printing", "Design services", "Bulk orders"],
  },
];

const GENERIC_FALLBACK = ["Consultations", "Custom quotes", "Free estimates", "Ongoing support"];

function findGroup(category: string): ServiceSuggestionGroup | undefined {
  const exact = SERVICE_SUGGESTIONS.find((g) => g.categories.includes(category));
  if (exact) return exact;
  return SERVICE_SUGGESTIONS.find((g) => g.categories.some((c) => category.includes(c)));
}

/** Category-typical service name suggestions, exact match before substring — same precedence as deterministicDesignSystem. */
export function suggestedServices(category?: string | null): string[] {
  if (!category) return [];
  const cat = category.toLowerCase().trim();
  if (!cat) return [];

  return findGroup(cat)?.services ?? GENERIC_FALLBACK;
}

/** Every group's first category string, unique across the whole catalog — used as a stable trade id. */
function tradeId(group: ServiceSuggestionGroup): string {
  return group.categories[0];
}

function titleCase(category: string): string {
  if (category === "hvac contractor") return "HVAC Contractor";
  return category.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "Event / Party" for a 2-alias group, just the title-cased category for everything else (3+ aliases get too long joined). */
function tradeLabel(group: ServiceSuggestionGroup): string {
  if (group.categories.length === 2) {
    return group.categories.map(titleCase).join(" / ");
  }
  return titleCase(tradeId(group));
}

export type TradeOption = { id: string; label: string };

/** One selectable option per suggestion group, for a multi-select "which trades apply" control. */
export const TRADE_OPTIONS: TradeOption[] = SERVICE_SUGGESTIONS.map((g) => ({
  id: tradeId(g),
  label: tradeLabel(g),
})).sort((a, b) => a.label.localeCompare(b.label));

/** Resolves free-text category input to the trade id an operator would land on by default. */
export function resolveTradeId(category?: string | null): string | null {
  if (!category) return null;
  const cat = category.toLowerCase().trim();
  if (!cat) return null;
  const group = findGroup(cat);
  return group ? tradeId(group) : null;
}

/** Union of suggested services across every selected trade id, in selection order, deduped. */
export function getServicesForTrades(tradeIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of tradeIds) {
    const group = SERVICE_SUGGESTIONS.find((g) => tradeId(g) === id);
    if (!group) continue;
    for (const service of group.services) {
      const key = service.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(service);
    }
  }
  return result;
}
