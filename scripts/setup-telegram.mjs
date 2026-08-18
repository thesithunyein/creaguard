#!/usr/bin/env node
/**
 * Points the Telegram bot at CreaGuard's webhook.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... \
 *   TELEGRAM_BOT_SECRET=<your own random secret, also set in Vercel> \
 *   TELEGRAM_WEBHOOK_URL=https://creaguard.sithunyein.com/api/telegram \
 *   node scripts/setup-telegram.mjs
 *
 * Token: create a bot with @BotFather and copy the token.
 * Secret: any long random string; it must match the TELEGRAM_BOT_SECRET
 * environment variable on the deployed app.
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_BOT_SECRET;
const url = process.env.TELEGRAM_WEBHOOK_URL;

if (!token || !secret || !url) {
  console.error(
    "Missing env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_SECRET, TELEGRAM_WEBHOOK_URL",
  );
  process.exit(1);
}

const response = await fetch(
  `https://api.telegram.org/bot${token}/setWebhook`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret_token: secret }),
  },
);
const json = (await response.json()) as {
  ok?: boolean;
  description?: string;
};
console.log(JSON.stringify(json, null, 2));
if (!json.ok) process.exit(1);
