import type { BrotherDefinition } from "../agentTypes";

// Throwaway test brother: proves the runtime end to end (one tiny Claude call,
// one approval). Delete when the `brothers` module lands.
export const pledge: BrotherDefinition = {
  id: "pledge",
  name: "Pledge",
  role: "Test brother: says hi, files one note",
  async run(ctx) {
    await ctx.setNow("saying hi");
    const hi = await ctx.ask({
      system: "You are a friendly frat pledge. Reply in five words or fewer.",
      prompt: "Say hi to the house.",
      maxTokens: 50,
    });
    await ctx.propose({ kind: "NOTE", title: "Pledge says hi", body: hi });
    return `said: ${hi}`;
  },
};
