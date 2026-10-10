import { describe, expect, it } from "vitest";
import { frankMessage, newestPrivateChat, webhookSecret } from "./telegram";

const update = (id: number, text?: string) => ({ message: { chat: { id, type: "private" }, text } });

describe("frankMessage", () => {
  it("passes only Frank's text through", () => {
    expect(frankMessage(update(42, " how are we doing? "), "42")).toBe("how are we doing?");
    expect(frankMessage(update(7, "hi"), "42")).toBeNull(); // a stranger
    expect(frankMessage(update(42), "42")).toBeNull(); // a sticker or photo
    expect(frankMessage(update(42, "hi"), null)).toBeNull(); // setup not done: nobody gets in
    expect(frankMessage(null, "42")).toBeNull();
  });
});

describe("newestPrivateChat", () => {
  it("picks the latest private chat, skipping groups", () => {
    const updates = [
      { message: { chat: { id: 1, type: "private", first_name: "Old" } } },
      { message: { chat: { id: 2, type: "private", username: "frank" } } },
      { message: { chat: { id: -3, type: "group" } } },
    ];
    expect(newestPrivateChat(updates)).toEqual({ id: "2", name: "@frank" });
    expect(newestPrivateChat([])).toBeNull();
    expect(newestPrivateChat("junk")).toBeNull();
  });
});

describe("webhookSecret", () => {
  it("is stable, token-specific and Telegram-safe", () => {
    expect(webhookSecret("a")).toBe(webhookSecret("a"));
    expect(webhookSecret("a")).not.toBe(webhookSecret("b"));
    expect(webhookSecret("a")).toMatch(/^[a-f0-9]{64}$/);
  });
});
