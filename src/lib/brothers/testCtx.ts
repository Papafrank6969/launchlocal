import type { BrotherContext } from "../agentTypes";

// Fake BrotherContext for brother tests: records every call, replies with `reply`.
export function fakeCtx(reply: string | Error = "[]") {
  const asks: Parameters<BrotherContext["ask"]>[0][] = [];
  const proposals: Parameters<BrotherContext["propose"]>[0][] = [];
  const nows: string[] = [];
  const ctx: BrotherContext = {
    async ask(input) {
      asks.push(input);
      if (reply instanceof Error) throw reply;
      return reply;
    },
    async propose(input) {
      proposals.push(input);
    },
    async setNow(text) {
      nows.push(text);
    },
  };
  return { ctx, asks, proposals, nows };
}
