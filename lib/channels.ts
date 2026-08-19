import type { Incident, IncidentStatus } from "./types";

/**
 * Sends a plain text message to a Telegram chat. Returns the message id,
 * or null when the bot is not configured or the send failed.
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { message_id?: number } };
    return json.result?.message_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Posts the creator's decision back to the same Telegram chat where the
 * verdict was delivered, so the loop is visible on the source channel.
 * Returns true when the message was sent.
 */
export async function postDecisionToTelegram(
  incident: Incident,
  status: IncidentStatus,
  note: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !incident.telegramChatId) return false;

  const decision =
    status === "resolved" ? "✅ Resolved" : status === "dismissed" ? "🚫 Dismissed" : status.replace("_", " ");
  const body = [
    `${decision} — case ${incident.externalId}`,
    note ? note : undefined,
    "Your Mind was taught this decision.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: incident.telegramChatId, text: body }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
