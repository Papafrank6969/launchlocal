import type { Metadata } from "next";

export function pageMetadata(opts: {
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
}): Metadata {
  const description = opts.description ?? undefined;
  return {
    title: opts.title,
    description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: opts.title,
      description,
      url: opts.path,
      images: opts.image ? [{ url: opts.image }] : undefined,
      type: "website",
    },
  };
}
