import { NextResponse } from "next/server";
import { saveTelegramChatId } from "@/lib/brothers/brotherData";
import { newestPrivateChat, sendTelegram, telegramCall, webhookSecret } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Behind the operator password (src/proxy.ts). One-time setup: Frank messages
// the bot, then this claims his chat as the only one the Boss answers and points
// Telegram's webhook here. Safe to re-run (e.g. after a new token or phone).
export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "Set TELEGRAM_BOT_TOKEN in Vercel first" }, { status: 503 });

  try {
    await telegramCall(token, "deleteWebhook", {}); // getUpdates only works with no webhook
    const chat = newestPrivateChat((await telegramCall(token, "getUpdates", {})).result);
    if (!chat) return NextResponse.json({ error: "Message the bot from your phone first, then run setup again" }, { status: 409 });

    await saveTelegramChatId(chat.id);
    const url = `${new URL(req.url).origin}/api/telegram`;
    await telegramCall(token, "setWebhook", { url, secret_token: webhookSecret(token), allowed_updates: ["message"], drop_pending_updates: true });
    await sendTelegram(token, chat.id, "Boss here. You're set up: text me anything about the houses, and my notes will land here.");
    return NextResponse.json({ chat: chat.name, webhook: url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
