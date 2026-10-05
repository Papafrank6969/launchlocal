import Anthropic from "@anthropic-ai/sdk";
import type { Usage } from "./agentCost";

let client: Anthropic | null = null;

// Reads ANTHROPIC_API_KEY from env. Only the agent runtime should call this —
// brothers go through ctx.ask() so every call is metered and capped.
export async function ask(input: {
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
}): Promise<{ text: string; usage: Usage }> {
  client ??= new Anthropic();
  const response = await client.messages.create({
    model: input.model,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined (${response.stop_details?.category ?? "no category"})`);
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return { text, usage: response.usage };
}
