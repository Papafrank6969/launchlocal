import { DESIGN_SYSTEMS, deterministicDesignSystem, type DesignSystem } from "@/lib/designSystems";

export type DesignChoice = {
  system: DesignSystem;
  rationale: string;
  aiGenerated: boolean;
};

export type BusinessBrief = {
  businessName: string;
  category?: string | null;
  tagline?: string | null;
  about?: string | null;
  serviceNames?: string[];
};

function fallback(brief: BusinessBrief): DesignChoice {
  const system = deterministicDesignSystem(brief.businessName, brief.category);
  return {
    system,
    rationale: `Picked "${system.name}" based on business category — set an ANTHROPIC_API_KEY to enable AI-driven selection.`,
    aiGenerated: false,
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

async function chooseDesignViaAI(brief: BusinessBrief, apiKey: string): Promise<DesignChoice> {
  const systemList = DESIGN_SYSTEMS.map(
    (s) => `- ${s.id}: ${s.mood} (typical fit: ${s.categories.join(", ")})`
  ).join("\n");

  const prompt = `You are picking a pre-built visual design system for a small local business's website. Only use the real information given below — never invent details about the business.

Business name: ${brief.businessName}
Category: ${brief.category ?? "unknown"}
Tagline: ${brief.tagline ?? "(none given)"}
About: ${brief.about ?? "(none given)"}
Services: ${brief.serviceNames?.length ? brief.serviceNames.join(", ") : "(none given)"}

Available design systems:
${systemList}

Pick the single design system id that best fits this specific business's category and tone.`;

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
              rationale: { type: "string", description: "One sentence explaining the choice, referencing the actual business." },
            },
            required: ["systemId", "rationale"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "select_design" },
      messages: [{ role: "user", content: prompt }],
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

  return { system, rationale, aiGenerated: true };
}
