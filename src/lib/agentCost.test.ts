import { describe, it, expect } from "vitest";
import { costMicros, MODEL_PRICES } from "./agentCost";

describe("MODEL_PRICES", () => {
  it("prices Haiku 4.5 at $1 in / $5 out per million tokens", () => {
    expect(MODEL_PRICES["claude-haiku-4-5"]).toEqual({ inputPerM: 1_000_000, outputPerM: 5_000_000 });
  });

  it("prices Sonnet 5.5 at $2 in / $10 out per million tokens", () => {
    expect(MODEL_PRICES["claude-sonnet-5-5"]).toEqual({ inputPerM: 2_000_000, outputPerM: 10_000_000 });
  });
});

describe("costMicros", () => {
  it("charges input and output tokens for Haiku", () => {
    expect(costMicros("claude-haiku-4-5", { input_tokens: 1000, output_tokens: 500 })).toBe(3500);
  });

  it("charges input and output tokens for Sonnet", () => {
    expect(costMicros("claude-sonnet-5-5", { input_tokens: 1000, output_tokens: 500 })).toBe(7000);
  });

  it("bills cache writes at 1.25x the input price", () => {
    expect(
      costMicros("claude-haiku-4-5", { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1000 })
    ).toBe(1250);
  });

  it("bills cache reads at 0.1x the input price", () => {
    expect(
      costMicros("claude-haiku-4-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1000 })
    ).toBe(100);
  });

  it("treats null cache fields as zero", () => {
    expect(
      costMicros("claude-haiku-4-5", {
        input_tokens: 10,
        output_tokens: 0,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      })
    ).toBe(10);
  });

  it("rounds a fractional micro-dollar up, never down", () => {
    // 1 cached token on Haiku = 0.1 micros → 1
    expect(
      costMicros("claude-haiku-4-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1 })
    ).toBe(1);
  });

  it("returns 0 for a call with no tokens", () => {
    expect(costMicros("claude-haiku-4-5", { input_tokens: 0, output_tokens: 0 })).toBe(0);
  });

  it("throws on an unknown model instead of treating it as free", () => {
    expect(() => costMicros("claude-mystery-1", { input_tokens: 1, output_tokens: 1 })).toThrow(
      "No price for model claude-mystery-1"
    );
  });
});
