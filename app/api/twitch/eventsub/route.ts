import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processIncomingMessage } from "@/lib/intake";
import { dedupeSeen } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Twitch EventSub webhook for channel.chat.message. Twitch verifies the
 * subscription with a GET challenge, then delivers chat events as signed
 * POSTs. Every message runs through the shared intake pipeline.
 */

function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  const messageId = headers.get("twitch-eventsub-message-id");
  const timestamp = headers.get("twitch-eventsub-message-timestamp");
  const signature = headers.get("twitch-eventsub-message-signature");
  if (!secret || !messageId || !timestamp || !signature) return false;

  // Reject stale deliveries to prevent replay attacks.
  const age = Math.abs(Date.now() - new Date(timestamp).getTime());
  if (age > 10 * 60 * 1000) return false;

  const expected = createHmac("sha256", secret)
    .update(`${messageId}${timestamp}${rawBody}`)
    .digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  if (!challenge) {
    return NextResponse.json({ error: "Missing challenge." }, { status: 400 });
  }
  // Twitch expects the raw challenge as the response body.
  return new NextResponse(challenge, {
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: {
    subscription?: { type?: string; status?: string };
    event?: {
      message_id?: string;
      chatter_user_name?: string;
      broadcaster_user_name?: string;
      message?: { text?: string };
    };
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.subscription?.type !== "channel.chat.message") {
    // Not a chat event (e.g. a revocation notice) — acknowledge it.
    return new NextResponse(null, { status: 204 });
  }

  const event = body.event;
  const text = event?.message?.text?.trim();
  if (!event || !text) {
    return new NextResponse(null, { status: 204 });
  }

  // Twitch may redeliver; never create a duplicate incident for one chat line.
  const fresh = await dedupeSeen("twitch", [event.message_id ?? `${event.chatter_user_name}:${text}`]);
  if (fresh.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const authorId = event.chatter_user_name ?? "twitch:unknown";
  await processIncomingMessage(text, authorId, "twitch");

  return new NextResponse(null, { status: 204 });
}
