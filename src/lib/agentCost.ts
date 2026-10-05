// Micro-dollars per 1M tokens (1_000_000 micros = $1.00). Money is integer
// micros everywhere in the Frat House runtime — never floats.
export const MODEL_PRICES: Record<string, { inputPerM: number; outputPerM: number }> = {
  "claude-haiku-4-5": { inputPerM: 1_000_000, outputPerM: 5_000_000 },
  "claude-sonnet-5-5": { inputPerM: 2_000_000, outputPerM: 10_000_000 },
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Cost of one call in micro-dollars, rounded up. Unknown model → throws (never silently free). */
export function costMicros(model: string, usage: Usage): number {
  const price = MODEL_PRICES[model];
  if (!price) throw new Error(`No price for model ${model}`);

  // Scale by 20 so cache multipliers (1.25x write, 0.1x read) stay integers.
  const scaled =
    20 * usage.input_tokens * price.inputPerM +
    20 * usage.output_tokens * price.outputPerM +
    25 * (usage.cache_creation_input_tokens ?? 0) * price.inputPerM +
    2 * (usage.cache_read_input_tokens ?? 0) * price.inputPerM;

  return Math.ceil(scaled / 20_000_000);
}
