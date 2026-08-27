import { slugify } from "@/lib/slug";

/**
 * The site editor sends the full services list on every save. Reconciling by
 * slug (instead of delete-all + recreate) keeps each row's id stable, which
 * matters now that services carry an uploaded `imageUrl` — a churned id would
 * lose the image on the next save.
 */

export type ExistingService = { id: string; slug: string; imageUrl: string | null };
export type IncomingService = {
  name?: string | null;
  description?: string | null;
  price?: string | null;
  imageUrl?: string | null;
};

type ServiceRow = {
  slug: string;
  name: string;
  description: string | null;
  price: string | null;
  imageUrl: string | null;
  order: number;
};

export type ServiceReconciliation = {
  create: ServiceRow[];
  update: { id: string; data: ServiceRow }[];
  deleteIds: string[];
};

export function reconcileServices(
  existing: ExistingService[],
  incoming: IncomingService[]
): ServiceReconciliation {
  const bySlug = new Map(existing.map((e) => [e.slug, e]));
  const usedSlugs = new Set<string>();
  const matchedIds = new Set<string>();

  const create: ServiceRow[] = [];
  const update: { id: string; data: ServiceRow }[] = [];

  incoming
    .map((s) => ({
      name: (s.name ?? "").trim(),
      description: (s.description ?? "").trim() || null,
      price: (s.price ?? "").trim() || null,
      imageUrlProvided: s.imageUrl !== undefined,
      imageUrl: (s.imageUrl ?? "").trim() || null,
    }))
    .filter((s) => s.name.length > 0)
    .forEach((s, i) => {
      const base = slugify(s.name) || `service-${i + 1}`;
      let slug = base;
      let n = 1;
      while (usedSlugs.has(slug)) {
        n += 1;
        slug = `${base}-${n}`;
      }
      usedSlugs.add(slug);

      const match = bySlug.get(slug);
      const row: ServiceRow = {
        slug,
        name: s.name,
        description: s.description,
        price: s.price,
        // Only touch the image when the caller sent one; otherwise keep what's there.
        imageUrl: s.imageUrlProvided ? s.imageUrl : match?.imageUrl ?? null,
        order: i,
      };

      if (match) {
        matchedIds.add(match.id);
        update.push({ id: match.id, data: row });
      } else {
        create.push(row);
      }
    });

  const deleteIds = existing.filter((e) => !matchedIds.has(e.id)).map((e) => e.id);
  return { create, update, deleteIds };
}
