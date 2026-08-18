import { NextResponse } from "next/server";
import { createPublicKey, verify } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { processIncomingMessage, type IntakeMeta } from "@/lib/intake";
import { defaultWorkspaceId } from "@/lib/workspace";
import { CATEGORY_LABELS, verdictFor } from "@/lib/verdict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Verifies the Discord Ed25519 request signature using the app public key. */
function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
): boolean {
  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKeyHex || !signature || !timestamp) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(
      null,
      Buffer.from(`${timestamp}${rawBody}`),
      key,
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

async function reviewAndCreate(
  message: string,
  authorId: string,
  meta: IntakeMeta,
) {
  // Same intake pipeline as every other channel (manual paste, Telegram,
  // webhooks): analyze -> risk score -> auto-handling tier -> store ->
  // autonomous Mind relay for high-risk cases.
  return processIncomingMessage(
    defaultWorkspaceId(),
    message,
    authorId,
    "discord",
    meta,
  );
}

async function patchInteraction(interactionToken: string, content: string) {
  const appId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !botToken || !interactionToken) return;
  await fetch(
    `https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify({ content }),
    },
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature-ed25519") ?? "";
  const timestamp = request.headers.get("x-signature-timestamp") ?? "";

  if (!verifyDiscordSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid request signature." }, { status: 401 });
  }

  let interaction: {
    type: number;
    token?: string;
    guild_id?: string;
    channel_id?: string;
    data?: {
      name?: string;
      options?: { name: string; value?: unknown }[];
    };
    member?: { user?: { id?: string; username?: string } };
    user?: { id?: string; username?: string };
  };
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Discord endpoint verification handshake.
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  if (interaction.type === 2) {
    const name = interaction.data?.name;
    if (name !== "review") {
      return NextResponse.json({
        type: 4,
        data: { content: "Unknown command." },
      });
    }

    const option = interaction.data?.options?.find((o) => o.name === "message");
    const message =
      typeof option?.value === "string" ? option.value.trim() : "";
    const authorId =
      interaction.member?.user?.username ?? interaction.user?.username ?? "";
    const interactionToken = interaction.token ?? "";
    // Offender identity + guild/channel pointers, for human-confirmed
    // enforcement (ban / timeout) later.
    const meta: IntakeMeta = {
      externalAuthorId:
        interaction.member?.user?.id ?? interaction.user?.id,
      sourceGuildId: interaction.guild_id,
      sourceChannelId: interaction.channel_id,
    };

    if (!message) {
      return NextResponse.json({
        type: 4,
        data: { content: "Usage: `/review <message>`" },
      });
    }

    // Acknowledge immediately (Discord's 3s timeout) and finish in the
    // background, then edit the reply with the full result.
    waitUntil(
      (async () => {
        try {
          const { incident, status } = await reviewAndCreate(
            message,
            authorId,
            meta,
          );
          const label = CATEGORY_LABELS[incident.category] ?? incident.category;
          const content = [
            `${label} — risk ${incident.riskScore}/100 (severity ${incident.severity}/5)`,
            `> ${message}`,
            `**${verdictFor(status)}**`,
          ].join("\n");
          await patchInteraction(interactionToken, content);
        } catch {
          await patchInteraction(
            interactionToken,
            "Something went wrong analyzing that message.",
          );
        }
      })(),
    );

    // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    return NextResponse.json({ type: 5 });
  }

  return NextResponse.json({ error: "Unsupported interaction." }, { status: 400 });
}
