import { NextResponse } from "next/server";
import { createPublicKey, verify } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { analyzeMessage } from "@/lib/analyze";
import { newId } from "@/lib/ids";
import { sendToMinds } from "@/lib/minds";
import {
  computeFollowUpAt,
  computeRisk,
  requiresHumanReview,
} from "@/lib/risk";
import { getIncidents, getPolicy, saveIncident } from "@/lib/store";
import type { Incident, IncidentEvent, RiskCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  threat: "🚨 Threat",
  doxxing: "⚠️ Doxxing",
  impersonation: "👤 Impersonation",
  scam: "💰 Scam",
  harassment: "🔁 Harassment",
  criticism: "💬 Criticism",
  other: "❔ Unclassified",
};

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

async function reviewAndCreate(message: string, authorId: string) {
  const classification = await analyzeMessage(message, authorId);
  const existing = await getIncidents();
  const related = existing.filter(
    (item) =>
      authorId && item.events.some((event) => event.authorId === authorId),
  );

  const status = requiresHumanReview(classification)
    ? "needs_review"
    : "monitoring";
  const { score, severity } = computeRisk(
    classification,
    related.reduce((sum, item) => sum + item.events.length, 0),
  );
  const followUpAt = computeFollowUpAt(score);

  const now = new Date().toISOString();
  const event: IncidentEvent = {
    id: newId("evt"),
    message,
    authorId: authorId || undefined,
    platform: "discord",
    createdAt: now,
    classification,
  };

  const incident: Incident = {
    id: newId("inc"),
    externalId: `INC-${Date.now().toString(36).toUpperCase()}`,
    events: [event],
    status,
    severity,
    riskScore: score,
    category: classification.category,
    createdAt: now,
    updatedAt: now,
    followUpAt: followUpAt || undefined,
  };

  await saveIncident(incident);

  // Autonomous follow-up: relay high-risk Discord messages to the Mind
  // immediately, no human click required.
  if (status === "needs_review") {
    const policy = await getPolicy();
    const relay = await sendToMinds(policy, incident);
    if (relay.alias) {
      incident.mindsAlias = relay.alias;
      await saveIncident(incident);
    }
  }

  return { incident, status };
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
    data?: {
      name?: string;
      options?: { name: string; value?: unknown }[];
    };
    member?: { user?: { username?: string } };
    user?: { username?: string };
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
          const { incident, status } = await reviewAndCreate(message, authorId);
          const label = CATEGORY_LABELS[incident.category] ?? incident.category;
          const needsReview = status === "needs_review";
          const content = [
            `${label} — risk ${incident.riskScore}/100 (severity ${incident.severity}/5)`,
            `> ${message}`,
            needsReview
              ? "**Escalated for human review.** Your Mind is reviewing this case now — open the dashboard to see its recommendation and approve."
              : "**Monitoring** — low risk, no action needed.",
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
