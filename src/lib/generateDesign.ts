import {
  DESIGN_SYSTEMS,
  deterministicDesignSystem,
  pickColorVariant,
  variantsOf,
  type DesignSystem,
} from "@/lib/designSystems";

export type DesignChoice = {
  system: DesignSystem;
  rationale: string;
  aiGenerated: boolean;
  /** Index into `variantsOf(system)` — the per-business accent + paper tint. */
  variant: number;
};

export type BusinessBrief = {
  businessName: string;
  category?: string | null;
  tagline?: string | null;
  about?: string | null;
  serviceNames?: string[];
  /** Absolute Vercel Blob URLs to operator-supplied reference photos (commonly
   *  screenshots from the business's Instagram) — fetched and sent to the model
   *  as real images, never fabricated. */
  inspirationImageUrls?: string[];
  /** Dominant hue (0-360) of the business's own photo, when we have one — used
   *  to match the color variant to the real storefront. Null → hash the name. */
  dominantHue?: number | null;
};

function variantFor(system: DesignSystem, brief: BusinessBrief): number {
  return pickColorVariant(system, {
    dominantHue: brief.dominantHue,
    businessName: brief.businessName,
  });
}

function variantNote(system: DesignSystem, variant: number, fromPhoto: boolean): string {
  if (variant === 0) return "";
  const name = variantsOf(system)[variant]?.name;
  if (!name) return "";
  return fromPhoto
    ? ` Accent tuned to a ${name.toLowerCase()} tone from the business's own photo.`
    : ` Accent set to a ${name.toLowerCase()} tone for this business.`;
}

function fallback(brief: BusinessBrief): DesignChoice {
  const system = deterministicDesignSystem(brief.businessName, brief.category);
  const variant = variantFor(system, brief);
  return {
    system,
    rationale:
      `Picked "${system.name}" based on business category — set an ANTHROPIC_API_KEY to enable AI-driven selection.` +
      variantNote(system, variant, brief.dominantHue != null),
    aiGenerated: false,
    variant,
  };
}

export async function chooseDesign(brief: BusinessBrief): Promise<DesignChoice> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback(brief);

  try {
    return await chooseDesignViaAI(brief, apiKey);
  } catch (err) {
    console.error("AI design selection failed, falling back to deterministic pick:", err);
    return fallback(brief);
  }
}

async function loadImageBlocks(urls: string[]): Promise<{ type: "image"; source: { type: "base64"; media_type: string; data: string } }[]> {
  const blocks = await Promise.all(
    urls.map(async (url) => {
      try {
        // These are always our own saved uploads in Vercel Blob (webp, from
        // imageUpload.ts) — never an arbitrary path.
        const response = await fetch(url);
        if (!response.ok) return null;
        const bytes = Buffer.from(await response.arrayBuffer());
        return {
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/webp", data: bytes.toString("base64") },
        };
      } catch {
        return null;
      }
    })
  );
  return blocks.filter((b): b is NonNullable<typeof b> => b !== null);
}

async function chooseDesignViaAI(brief: BusinessBrief, apiKey: string): Promise<DesignChoice> {
  const systemList = DESIGN_SYSTEMS.map(
    (s) => `- ${s.id}: ${s.mood} (typical fit: ${s.categories.join(", ")})`
  ).join("\n");

  const imageUrls = brief.inspirationImageUrls ?? [];
  const imageBlocks = imageUrls.length > 0 ? await loadImageBlocks(imageUrls) : [];

  const prompt = `You are picking a pre-built visual design system for a small local business's website. Only use the real information given below — never invent details about the business.

Business name: ${brief.businessName}
Category: ${brief.category ?? "unknown"}
Tagline: ${brief.tagline ?? "(none given)"}
About: ${brief.about ?? "(none given)"}
Services: ${brief.serviceNames?.length ? brief.serviceNames.join(", ") : "(none given)"}
${
  imageBlocks.length > 0
    ? `\nThe ${imageBlocks.length} image(s) attached are reference photos the operator provided (often screenshots from the business's own Instagram) — look at their actual visual style (colors, mood, photography style, whether it's warm/cool, minimal/busy, dark/bright) and weigh that alongside the text above when picking.`
    : ""
}

Available design systems:
${systemList}

Pick the single design system id that best fits this specific business's category, tone, and (if provided) visual style. If a reference photo's aesthetic conflicts with the "typical fit" for its category, prefer what the photo actually shows — that's real signal from the business, the category list is just a starting guess.`;

  const content: unknown[] = [{ type: "text", text: prompt }, ...imageBlocks];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      tools: [
        {
          name: "select_design",
          description: "Select the design system that best fits this business",
          input_schema: {
            type: "object",
            properties: {
              systemId: { type: "string", enum: DESIGN_SYSTEMS.map((s) => s.id) },
              rationale: {
                type: "string",
                description:
                  "One sentence explaining the choice, referencing the actual business and, if photos were provided, what in them informed the pick.",
              },
            },
            required: ["systemId", "rationale"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "select_design" },
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const toolUse = (json.content ?? []).find((block: { type: string }) => block.type === "tool_use");
  if (!toolUse) throw new Error("No tool_use block in Anthropic response");

  const { systemId, rationale } = toolUse.input as { systemId: string; rationale: string };
  const system = DESIGN_SYSTEMS.find((s) => s.id === systemId);
  if (!system) throw new Error(`Model returned unknown systemId: ${systemId}`);

  const variant = variantFor(system, brief);
  return {
    system,
    rationale: rationale + variantNote(system, variant, brief.dominantHue != null),
    aiGenerated: true,
    variant,
  };
}
