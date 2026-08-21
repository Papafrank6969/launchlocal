import { PrismaClient } from "@prisma/client";
import { deterministicDesignSystem } from "../src/lib/designSystems";

const db = new PrismaClient();

async function main() {
  const sites = await db.site.findMany({ where: { designSystemId: null } });
  let updated = 0;

  for (const site of sites) {
    const system = deterministicDesignSystem(site.businessName, site.category);
    await db.site.update({
      where: { id: site.id },
      data: {
        designSystemId: system.id,
        designRationale: `Picked "${system.name}" based on business category (backfilled).`,
      },
    });
    updated += 1;
  }

  console.log(`Backfilled designSystemId for ${updated} site(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
