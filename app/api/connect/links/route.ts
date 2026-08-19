import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Discord permission integer: Ban Members, Moderate Members, Manage
 * Messages, Send Messages, View Channels, Read Message History, Use Slash
 * Commands — the exact set the bot needs for moderation. */
const DISCORD_PERMISSIONS = 1101659188228;

/**
 * Returns the deep links the connect wizard opens when a creator picks a
 * channel: Telegram -> the bot's chat (via getMe), Discord -> the add-bot
 * invite, YouTube -> youtube.com (to grab a video link).
 */
export async function GET() {
  const links: Record<string, string | null> = {
    telegram: null,
    discord: null,
    youtube: "https://www.youtube.com",
  };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/getMe`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const json = (await res.json()) as {
          result?: { username?: string };
        };
        const username = json.result?.username;
        if (username) links.telegram = `https://t.me/${username}`;
      }
    } catch {
      links.telegram = null;
    }
  }

  const appId = process.env.DISCORD_APPLICATION_ID;
  if (appId) {
    links.discord =
      `https://discord.com/oauth2/authorize?client_id=${appId}` +
      `&permissions=${DISCORD_PERMISSIONS}&scope=bot+applications.commands`;
  }

  return NextResponse.json({ links });
}
