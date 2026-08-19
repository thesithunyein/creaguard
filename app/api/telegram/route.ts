import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { processIncomingMessage } from "@/lib/intake";
import { recordChannelPing, saveIncident } from "@/lib/store";
import { defaultWorkspaceId } from "@/lib/workspace";
import { CATEGORY_LABELS, verdictFor } from "@/lib/verdict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUIDE = [
  "CreaGuard — creator safety bot.",
  "",
  "Send any message and it is analyzed for threats, doxxing, impersonation, scams, and harassment against your policy. High-risk cases are relayed to your Mind for review.",
  "",
  "Commands:",
  "/review <message> — analyze a specific message",
  "/start — this guide",
  "",
  "Every case lands in your dashboard, where you decide.",
].join("\n");

async function sendTelegramMessage(chatId: number, text: string): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { message_id?: number } };
  return json.result?.message_id ?? null;
}

export async function POST(request: Request) {
  // Secret-token check: set by the setup script via setWebhook(secret_token).
  const secret = process.env.TELEGRAM_BOT_SECRET;
  const provided = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Invalid secret token." }, { status: 401 });
  }

  let update: {
    message?: {
      message_id?: number;
      text?: string;
      chat?: { id?: number };
      from?: { id?: number; username?: string; first_name?: string };
    };
  };
  try {
    update = (await request.json()) as typeof update;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  if (!message || typeof chatId !== "number") {
    return NextResponse.json({ ok: true });
  }

  const text = (message.text ?? "").trim();
  const authorId = message.from?.username
    ? `@${message.from.username}`
    : `tg:${message.from?.id ?? "unknown"}`;

  // Any message from a creator's bot proves the channel is connected — even
  // a /start command that just gets the guide back (no case is created).
  waitUntil(
    recordChannelPing(defaultWorkspaceId(), "telegram").catch(() => undefined),
  );

  if (!text || text.startsWith("/")) {
    await sendTelegramMessage(chatId, GUIDE);
    return NextResponse.json({ ok: true });
  }

  // Acknowledge immediately and analyze in the background, then report
  // back through the same pipeline every other channel uses.
  waitUntil(
    (async () => {
      try {
        const ws = defaultWorkspaceId();
        const { incident, status } = await processIncomingMessage(
          ws,
          text,
          authorId,
          "telegram",
          {
            externalAuthorId: message.from?.id
              ? String(message.from.id)
              : undefined,
            sourceChannelId: String(chatId),
            sourceMessageId: message.message_id
              ? String(message.message_id)
              : undefined,
          },
        );
        const reply = [
          `${CATEGORY_LABELS[incident.category] ?? incident.category} — risk ${incident.riskScore}/100 (severity ${incident.severity}/5)`,
          `> ${text}`,
          verdictFor(status),
          `Case ${incident.externalId} — open the dashboard to review.`,
        ].join("\n");
        const messageId = await sendTelegramMessage(chatId, reply);
        if (messageId) {
          // Remember where the verdict was posted so a later Resolve/Dismiss
          // can post the decision back into this same chat.
          incident.telegramChatId = chatId;
          incident.telegramMessageId = messageId;
          await saveIncident(ws, incident);
        }
      } catch {
        await sendTelegramMessage(
          chatId,
          "Something went wrong analyzing that message.",
        );
      }
    })(),
  );

  return NextResponse.json({ ok: true });
}
