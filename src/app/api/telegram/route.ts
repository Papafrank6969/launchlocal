import { NextResponse } from "next/server";
import { prismaRunnerDeps } from "@/lib/agentDeps";
import { chatTurn } from "@/lib/agentChat";
import { findBrother } from "@/lib/brothers";
import { chatStore, telegramChatId } from "@/lib/brothers/brotherData";
import { safeEqual } from "@/lib/operatorAuth";
import { frankMessage, sendTelegram, webhookSecret } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Telegram's webhook (src/lib/telegram.ts). Public path, so it's locked by the
// secret Telegram sends back on every call, and only Frank's chat gets an answer.
// Always 200 once authenticated: anything else makes Telegram redeliver.
export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "Telegram not configured" }, { status: 503 });
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token") ?? "", webhookSecret(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chatId = await telegramChatId();
  const text = frankMessage(await req.json().catch(() => null), chatId);
  if (!text || !chatId) return NextResponse.json({ ok: true });

  const result = await chatTurn(findBrother("boss")!, text, { ...prismaRunnerDeps(), ...chatStore });
  await sendTelegram(token, chatId, result.ok ? result.reply : `Can't answer right now: ${result.error}`).catch(() => {});
  return NextResponse.json({ ok: true });
}
