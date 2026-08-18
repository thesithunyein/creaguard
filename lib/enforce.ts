import type { Incident } from "./types";

export type EnforceAction = "ban" | "timeout" | "delete";

export interface EnforceResult {
  ok: boolean;
  platform: string;
  action: EnforceAction;
  detail?: string;
}

async function enforceDiscord(
  incident: Incident,
  action: EnforceAction,
): Promise<EnforceResult> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return {
      ok: false,
      platform: "discord",
      action,
      detail: "Discord bot token is not configured.",
    };
  }
  if (!incident.sourceGuildId || !incident.externalAuthorId) {
    return {
      ok: false,
      platform: "discord",
      action,
      detail: "Missing guild or author id — the case was created before enforcement metadata existed.",
    };
  }

  let url: string;
  let method: string;
  let body: Record<string, unknown> | undefined;

  if (action === "ban") {
    url = `https://discord.com/api/v10/guilds/${incident.sourceGuildId}/bans/${incident.externalAuthorId}`;
    method = "PUT";
  } else if (action === "timeout") {
    url = `https://discord.com/api/v10/guilds/${incident.sourceGuildId}/members/${incident.externalAuthorId}`;
    method = "PATCH";
    body = {
      communication_disabled_until: new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
  } else {
    if (!incident.sourceChannelId || !incident.sourceMessageId) {
      return {
        ok: false,
        platform: "discord",
        action,
        detail: "No message id to delete — Discord slash commands are not messages.",
      };
    }
    url = `https://discord.com/api/v10/channels/${incident.sourceChannelId}/messages/${incident.sourceMessageId}`;
    method = "DELETE";
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    ok: res.status === 200 || res.status === 204,
    platform: "discord",
    action,
    detail: res.ok ? undefined : `Discord returned ${res.status}.`,
  };
}

async function enforceTelegram(
  incident: Incident,
  action: EnforceAction,
): Promise<EnforceResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      ok: false,
      platform: "telegram",
      action,
      detail: "Telegram bot token is not configured.",
    };
  }
  if (!incident.telegramChatId) {
    return {
      ok: false,
      platform: "telegram",
      action,
      detail: "Missing Telegram chat id.",
    };
  }

  if (action === "delete") {
    const messageId = Number(incident.sourceMessageId);
    if (!messageId) {
      return {
        ok: false,
        platform: "telegram",
        action,
        detail: "Missing the offending message id.",
      };
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: incident.telegramChatId,
        message_id: messageId,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; description?: string };
    return {
      ok: Boolean(json.ok),
      platform: "telegram",
      action,
      detail: json.ok ? undefined : json.description,
    };
  }

  // ban (or timeout as a 24h restriction).
  const userId = Number(incident.externalAuthorId);
  if (!userId) {
    return {
      ok: false,
      platform: "telegram",
      action,
      detail: "Missing the offending user id.",
    };
  }
  const endpoint =
    action === "timeout" ? "restrictChatMember" : "banChatMember";
  const payload: Record<string, unknown> = {
    chat_id: incident.telegramChatId,
    user_id: userId,
  };
  if (action === "timeout") {
    payload.until_date = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    payload.permissions = { can_send_messages: false };
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { ok?: boolean; description?: string };
  return {
    ok: Boolean(json.ok),
    platform: "telegram",
    action,
    detail: json.ok ? undefined : json.description,
  };
}

/**
 * Dispatches a human-confirmed enforcement action to the platform the case
 * came from. YouTube has no moderation API, so it returns an honest
 * "manual escalation" result instead of pretending to act.
 */
export async function enforceAction(
  incident: Incident,
  action: EnforceAction,
): Promise<EnforceResult> {
  const platform = incident.events.at(-1)?.platform;
  if (platform === "discord") return enforceDiscord(incident, action);
  if (platform === "telegram") return enforceTelegram(incident, action);
  return {
    ok: false,
    platform: platform ?? "unknown",
    action,
    detail:
      "This platform can't be moderated through an API — CreaGuard only recommends; take the action manually on the platform.",
  };
}
