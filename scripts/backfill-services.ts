import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/slug";

const db = new PrismaClient();

function serviceList(services: string | null): string[] {
  return (services ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const sites = await db.site.findMany({ include: { serviceItems: true } });
  let created = 0;

  for (const site of sites) {
    if (site.serviceItems.length > 0) continue;
    const names = serviceList(site.services);
    if (names.length === 0) continue;

    const seen = new Set<string>();
    for (const [i, name] of names.entries()) {
      let slug = slugify(name) || `service-${i + 1}`;
      let n = 1;
      while (seen.has(slug)) {
        n += 1;
        slug = `${slugify(name)}-${n}`;
      }
      seen.add(slug);
      await db.service.create({ data: { siteId: site.id, slug, name, order: i } });
      created += 1;
    }
  }

  console.log(`Backfilled ${created} Service rows from existing free-text service lists.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
