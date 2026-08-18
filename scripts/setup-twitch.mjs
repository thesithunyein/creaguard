#!/usr/bin/env node
/**
 * Subscribes CreaGuard to a Twitch channel's chat via EventSub webhooks.
 *
 * Usage:
 *   TWITCH_CLIENT_ID=... \
 *   TWITCH_CLIENT_SECRET=... \
 *   TWITCH_EVENTSUB_SECRET=<your own random secret, also set in Vercel> \
 *   TWITCH_WEBHOOK_URL=https://creaguard.sithunyein.com/api/twitch/eventsub \
 *   node scripts/setup-twitch.mjs
 *
 * The script opens a browser OAuth flow so the streamer authorizes the app
 * to read their own chat (scope: user:read:chat). Paste the code it prints
 * back into the terminal when prompted.
 *
 * Client id/secret: https://dev.twitch.tv/console/apps (create an app, set
 * the OAuth redirect to https://creaguard.sithunyein.com/twitch-callback —
 * Twitch requires HTTPS redirect URIs). Override with TWITCH_REDIRECT_URI.
 */
import { createInterface } from "node:readline/promises";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const secret = process.env.TWITCH_EVENTSUB_SECRET;
const callback = process.env.TWITCH_WEBHOOK_URL;

if (!clientId || !clientSecret || !secret || !callback) {
  console.error(
    "Missing env vars: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_EVENTSUB_SECRET, TWITCH_WEBHOOK_URL",
  );
  process.exit(1);
}

const REDIRECT_URI =
  process.env.TWITCH_REDIRECT_URI ?? "https://creaguard.sithunyein.com/twitch-callback";
const SCOPES = "user:read:chat moderator:read:chats";

async function appToken() {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    console.error("Failed to get app token:", JSON.stringify(json));
    process.exit(1);
  }
  return json.access_token;
}

async function userToken() {
  if (process.env.TWITCH_USER_TOKEN) return process.env.TWITCH_USER_TOKEN;
  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  console.log("\n1. Open this URL and authorize the app:\n");
  console.log(url.toString());
  console.log(
    `\n2. After authorizing you'll land on ${REDIRECT_URI} — the page shows the code. Copy it.`,
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question("3. Paste the code from that page: ")).trim();
  rl.close();
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    console.error("Failed to exchange code:", JSON.stringify(json));
    process.exit(1);
  }
  return json.access_token;
}

const [appAccessToken, userAccessToken] = await Promise.all([appToken(), userToken()]);

// Resolve the authorized user (the streamer whose chat we monitor).
const usersRes = await fetch("https://api.twitch.tv/helix/users", {
  headers: { Authorization: `Bearer ${userAccessToken}`, "Client-Id": clientId },
});
const usersJson = (await usersRes.json()) as {
  data?: Array<{ id?: string; login?: string; display_name?: string }>;
};
const user = usersJson.data?.[0];
if (!user?.id) {
  console.error("Could not resolve the authorized user:", JSON.stringify(usersJson));
  process.exit(1);
}
console.log(`\nMonitoring chat for: ${user.display_name} (${user.id})`);

// Subscribe to chat messages in that channel.
const subRes = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${appAccessToken}`,
    "Client-Id": clientId,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: "channel.chat.message",
    version: "1",
    condition: { broadcaster_user_id: user.id, user_id: user.id },
    transport: {
      method: "webhook",
      callback,
      secret,
    },
  }),
});
const subJson = await subRes.json();
console.log("\nSubscription result:", JSON.stringify(subJson, null, 2));
if (subJson.status === 409) {
  console.log("\nAlready subscribed — this is fine.");
  process.exit(0);
}
if (!subJson.data?.[0]) process.exit(1);
console.log("\nDone. Save this user token as TWITCH_USER_TOKEN to re-run later:");
console.log(userAccessToken);
