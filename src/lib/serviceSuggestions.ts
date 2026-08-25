type ServiceSuggestionGroup = { categories: string[]; services: string[] };

/**
 * Curated, category-typical service names an operator can one-click add to a
 * site — never business-specific claims, just what businesses in that trade
 * commonly offer. Same exact-then-substring category matching as
 * deterministicDesignSystem in designSystems.ts, and covers the same
 * category vocabulary used there.
 */
const SERVICE_SUGGESTIONS: ServiceSuggestionGroup[] = [
  {
    categories: ["bakery"],
    services: ["Custom cakes", "Fresh bread & pastries", "Catering trays", "Custom cookies"],
  },
  {
    categories: ["cafe", "coffee shop"],
    services: ["Espresso & coffee", "Pastries & baked goods", "Catering & office orders", "Private events"],
  },
  {
    categories: ["restaurant"],
    services: ["Dine-in", "Takeout & delivery", "Private events & catering", "Happy hour"],
  },
  {
    categories: ["florist"],
    services: ["Custom arrangements", "Wedding & event florals", "Same-day delivery", "Subscription bouquets"],
  },
  {
    categories: ["caterer"],
    services: ["Weddings", "Corporate events", "Private parties", "Menu tastings"],
  },
  {
    categories: ["law firm"],
    services: ["Consultations", "Litigation", "Contract review", "Estate planning"],
  },
  {
    categories: ["accounting"],
    services: ["Tax preparation", "Bookkeeping", "Payroll services", "Audit support"],
  },
  {
    categories: ["financial"],
    services: ["Financial planning", "Retirement planning", "Investment management", "Tax strategy"],
  },
  {
    categories: ["consulting"],
    services: ["Strategy consulting", "Process improvement", "Market research", "Ongoing advisory"],
  },
  {
    categories: ["insurance"],
    services: ["Auto insurance", "Home insurance", "Life insurance", "Policy review"],
  },
  {
    categories: ["landscaping"],
    services: ["Lawn maintenance", "Landscape design", "Irrigation installation", "Seasonal cleanup"],
  },
  {
    categories: ["gardening", "nursery"],
    services: ["Plant selection", "Garden design", "Planting & installation", "Seasonal maintenance"],
  },
  {
    categories: ["lawn care"],
    services: ["Mowing & edging", "Fertilization", "Weed control", "Aeration & seeding"],
  },
  {
    categories: ["farm"],
    services: ["Farm-fresh produce", "CSA subscriptions", "Farm stand", "Wholesale orders"],
  },
  {
    categories: ["gym", "fitness"],
    services: ["Personal training", "Group classes", "Nutrition coaching", "Membership plans"],
  },
  {
    categories: ["event", "party"],
    services: ["Event planning", "Venue rental", "Party packages", "Day-of coordination"],
  },
  {
    categories: ["food truck"],
    services: ["Catering bookings", "Private events", "Daily menu", "Custom orders"],
  },
  {
    categories: ["kids"],
    services: ["Birthday parties", "Classes & camps", "Open play", "Group bookings"],
  },
  {
    categories: ["salon", "hair salon"],
    services: ["Haircuts & styling", "Color & highlights", "Blowouts", "Bridal styling"],
  },
  {
    categories: ["spa"],
    services: ["Massage therapy", "Facials", "Body treatments", "Spa packages"],
  },
  {
    categories: ["boutique"],
    services: ["Personal styling", "New arrivals", "Gift wrapping", "Custom orders"],
  },
  {
    categories: ["beauty"],
    services: ["Makeup application", "Skincare consultations", "Lash & brow services", "Product recommendations"],
  },
  {
    categories: ["jewelry"],
    services: ["Custom design", "Repairs & resizing", "Cleaning & inspection", "Appraisals"],
  },
  {
    categories: ["auto repair", "mechanic"],
    services: ["Oil changes", "Brake service", "Engine diagnostics", "State inspection"],
  },
  {
    categories: ["hvac contractor"],
    services: ["AC repair", "Heating repair", "System installation", "Maintenance plans"],
  },
  {
    categories: ["plumber"],
    services: ["Drain cleaning", "Water heater repair", "Leak detection", "Repiping"],
  },
  {
    categories: ["electrician"],
    services: ["Panel upgrades", "Wiring & rewiring", "Lighting installation", "Emergency service"],
  },
  {
    categories: ["contractor"],
    services: ["Home renovations", "Additions", "Kitchen & bath remodels", "Project management"],
  },
  {
    categories: ["dentist"],
    services: ["Cleanings & checkups", "Cosmetic dentistry", "Teeth whitening", "Emergency dental care"],
  },
  {
    categories: ["pediatric"],
    services: ["Well-child visits", "Vaccinations", "Sick visits", "Developmental screenings"],
  },
  {
    categories: ["veterinary"],
    services: ["Wellness exams", "Vaccinations", "Dental care", "Surgery"],
  },
  {
    categories: ["family services"],
    services: ["Counseling", "Family mediation", "Support groups", "Referral services"],
  },
  {
    categories: ["clinic"],
    services: ["Primary care", "Preventive screenings", "Same-day appointments", "Lab testing"],
  },
  {
    categories: ["brewery"],
    services: ["Tastings & flights", "Growler fills", "Private events", "Brewery tours"],
  },
  {
    categories: ["woodworking"],
    services: ["Custom furniture", "Restoration", "Commissioned pieces", "Repairs"],
  },
  {
    categories: ["pottery"],
    services: ["Custom pieces", "Classes & workshops", "Wedding registries", "Wholesale orders"],
  },
  {
    categories: ["handmade", "craft"],
    services: ["Custom orders", "Workshops", "Wholesale inquiries", "Gift sets"],
  },
  {
    categories: ["fine jewelry", "jeweler", "luxury goods", "atelier"],
    services: ["Custom design", "Engagement rings", "Repairs & restoration", "Appraisals"],
  },
  {
    categories: ["fine dining", "upscale restaurant", "wine bar", "steakhouse", "tasting menu"],
    services: ["Tasting menu", "Wine pairings", "Private dining", "Chef's table"],
  },
  {
    categories: ["real estate", "realtor"],
    services: ["Buyer representation", "Seller representation", "Market analysis", "Relocation services"],
  },
  {
    categories: ["interior design", "interior designer"],
    services: ["Full-service design", "Space planning", "Furniture selection", "Styling & staging"],
  },
  {
    categories: ["home staging"],
    services: ["Vacant staging", "Occupied staging", "Design consultation", "Photography prep"],
  },
];

const GENERIC_FALLBACK = ["Consultations", "Custom quotes", "Free estimates", "Ongoing support"];

/** Category-typical service name suggestions, exact match before substring — same precedence as deterministicDesignSystem. */
export function suggestedServices(category?: string | null): string[] {
  if (!category) return [];
  const cat = category.toLowerCase().trim();
  if (!cat) return [];

  const exact = SERVICE_SUGGESTIONS.find((g) => g.categories.includes(cat));
  if (exact) return exact.services;

  const partial = SERVICE_SUGGESTIONS.find((g) => g.categories.some((c) => cat.includes(c)));
  if (partial) return partial.services;

  return GENERIC_FALLBACK;
}
