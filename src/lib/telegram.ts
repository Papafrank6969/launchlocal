import { createHash } from "node:crypto";

// The Boss on Frank's phone (2026-10-10): Frank texts the Boss through a
// Telegram bot and the Boss's notes arrive as push notifications. The bot token
// lives only in Vercel (TELEGRAM_BOT_TOKEN). Frank's chat id is claimed once by
// the operator-only setup route, and every other chat is ignored.

/** Telegram caps a message at 4096 characters. */
export const TELEGRAM_MAX = 4000;
export const TELEGRAM_CHAT_STATE = "telegram-chat";

const api = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

/** Webhook secret derived from the token, so there's no second env var to keep in sync. */
export function webhookSecret(token: string): string {
  return createHash("sha256").update(`webhook:${token}`).digest("hex").slice(0, 64);
}

export async function telegramCall(token: string, method: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(api(token, method), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.ok !== true) throw new Error(`Telegram ${method}: ${res.status} ${String(json.description ?? "")}`.trim());
  return json;
}

export async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
  await telegramCall(token, "sendMessage", { chat_id: chatId, text: text.slice(0, TELEGRAM_MAX) });
}

type Update = { message?: { chat?: { id?: number; type?: string }; text?: string } };

/** Only Frank's chat reaches the Boss; anything else, or anything that isn't text, is dropped without a reply. */
export function frankMessage(update: unknown, frankChatId: string | null): string | null {
  const msg = (update as Update | null)?.message;
  if (!frankChatId || String(msg?.chat?.id) !== frankChatId) return null;
  return typeof msg?.text === "string" && msg.text.trim() ? msg.text.trim() : null;
}

/** The newest private chat in getUpdates: whoever just messaged the bot during setup. */
export function newestPrivateChat(updates: unknown): { id: string; name: string } | null {
  const list = Array.isArray(updates) ? (updates as { message?: { chat?: { id?: number; type?: string; first_name?: string; username?: string } } }[]) : [];
  for (const u of [...list].reverse()) {
    const chat = u.message?.chat;
    if (chat?.type === "private" && typeof chat.id === "number") return { id: String(chat.id), name: chat.username ? `@${chat.username}` : (chat.first_name ?? "?") };
  }
  return null;
}
