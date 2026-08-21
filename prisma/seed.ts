import { PrismaClient } from "@prisma/client";
import { scoreWebsite } from "../src/lib/places";
import { slugify } from "../src/lib/slug";

const db = new PrismaClient();

const DEMO_LEADS = [
  { name: "Sunrise Plumbing Co.", category: "plumber", city: "Austin, TX", url: undefined, rating: 4.6, reviews: 82 },
  { name: "Blue Ridge Hair Studio", category: "hair salon", city: "Austin, TX", url: "https://facebook.com/blueridgehair", rating: 4.2, reviews: 44 },
  { name: "Maple Bread Co.", category: "bakery", city: "Austin, TX", url: undefined, rating: 4.8, reviews: 120 },
  { name: "Downtown Auto Care", category: "auto repair", city: "Austin, TX", url: "https://www.downtownautocare.com", rating: 4.4, reviews: 61 },
  { name: "Riverside Landscaping", category: "landscaping", city: "Austin, TX", url: undefined, rating: 4.1, reviews: 19 },
  { name: "Golden Dental Group", category: "dentist", city: "Austin, TX", url: "https://facebook.com/goldendental", rating: 4.5, reviews: 200 },
  { name: "Summit Coffee House", category: "coffee shop", city: "Austin, TX", url: undefined, rating: 4.7, reviews: 340 },
  { name: "Coastal HVAC Services", category: "hvac contractor", city: "Austin, TX", url: "https://www.coastalhvac.com", rating: 4.3, reviews: 55 },
];

async function main() {
  console.log("Seeding demo data...");

  const leads = [];
  for (const l of DEMO_LEADS) {
    const websiteStatus = scoreWebsite(l.url);
    const lead = await db.lead.create({
      data: {
        name: l.name,
        category: l.category,
        address: `${100 + Math.floor(Math.random() * 900)} Main St, ${l.city}`,
        city: l.city,
        phone: `(512) 555-${1000 + Math.floor(Math.random() * 8999)}`,
        existingUrl: l.url,
        rating: l.rating,
        reviewCount: l.reviews,
        websiteStatus,
        source: "MOCK",
        placeId: `seed_${slugify(l.name)}`,
      },
    });
    leads.push(lead);
  }

  await db.event.createMany({ data: leads.map(() => ({ type: "LEAD_FOUND" as const })) });

  const publishedLead = leads.find((l) => l.name === "Sunrise Plumbing Co.")!;
  const publishedSite = await db.site.create({
    data: {
      slug: "sunrise-plumbing-co",
      businessName: "Sunrise Plumbing Co.",
      tagline: "Fast, friendly, family-owned since 1998",
      about: "We handle everything from leaky faucets to full repipes, with same-day service across Austin.",
      hours: "Mon-Fri: 8am-6pm\nSat: 9am-2pm",
      phone: publishedLead.phone,
      address: publishedLead.address,
      template: "modern",
      primaryColor: "#2a78d6",
      status: "PUBLISHED",
      leadId: publishedLead.id,
      serviceItems: {
        create: [
          { slug: "drain-cleaning", name: "Drain cleaning", order: 0 },
          { slug: "water-heater-repair", name: "Water heater repair", order: 1 },
          { slug: "emergency-service", name: "Emergency service", order: 2 },
          { slug: "repiping", name: "Repiping", order: 3 },
        ],
      },
    },
  });
  await db.event.create({ data: { type: "SITE_CREATED", siteId: publishedSite.id } });
  await db.event.create({ data: { type: "SITE_PUBLISHED", siteId: publishedSite.id } });

  const draftLead = leads.find((l) => l.name === "Maple Bread Co.")!;
  const draftSite = await db.site.create({
    data: {
      slug: "maple-bread-co",
      businessName: "Maple Bread Co.",
      tagline: "Fresh-baked every morning",
      about: "A neighborhood bakery specializing in sourdough, pastries, and custom cakes.",
      template: "classic",
      primaryColor: "#eb6834",
      status: "DRAFT",
      leadId: draftLead.id,
      serviceItems: {
        create: [
          { slug: "sourdough-bread", name: "Sourdough bread", order: 0 },
          { slug: "pastries", name: "Pastries", order: 1 },
          { slug: "custom-cakes", name: "Custom cakes", order: 2 },
          { slug: "catering", name: "Catering", order: 3 },
        ],
      },
    },
  });
  await db.event.create({ data: { type: "SITE_CREATED", siteId: draftSite.id } });

  const now = new Date();
  const viewEvents = [];
  for (let i = 0; i < 30; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const viewsToday = Math.floor(Math.random() * 12) + (i < 7 ? 5 : 0);
    for (let v = 0; v < viewsToday; v++) {
      const createdAt = new Date(day);
      createdAt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
      viewEvents.push({ type: "SITE_VIEW" as const, siteId: publishedSite.id, createdAt });
    }
  }
  for (const e of viewEvents) {
    await db.event.create({ data: e });
  }

  console.log(`Seeded ${leads.length} leads, 2 sites, ${viewEvents.length} view events.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
