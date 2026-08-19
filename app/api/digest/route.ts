import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/channels";
import { getIncidents, getProposals, getSuspects } from "@/lib/store";
import { currentWorkspaceId } from "@/lib/workspace";
import { CATEGORY_LABELS } from "@/lib/verdict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Morning digest — the scheduled job that makes the agent's continuity
 * visible without anyone opening the dashboard: every day it summarizes
 * what happened, what needs a decision, and who is repeating.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const ws = await currentWorkspaceId();
  const incidents = await getIncidents(ws);
  const suspects = await getSuspects(ws);
  const proposals = await getProposals(ws);

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const newCases = incidents.filter(
    (incident) => new Date(incident.createdAt).getTime() >= dayAgo,
  );
  const awaiting = incidents.filter(
    (incident) =>
      incident.status === "needs_review" || incident.status === "quarantined",
  );
  const repeatOffenders = suspects.filter(
    (suspect) => suspect.incidentIds.length > 1,
  );
  const pendingProposals = proposals.filter(
    (proposal) => proposal.status === "pending",
  );
  const resolved = incidents.filter((incident) => incident.status === "resolved");
  const dismissed = incidents.filter((incident) => incident.status === "dismissed");

  const lines = [
    "🌅 CreaGuard morning digest",
    `— ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
    "",
    `📥 ${newCases.length} new case${newCases.length === 1 ? "" : "s"} in the last 24h`,
    ...newCases.slice(0, 3).map(
      (incident) =>
        `   • ${CATEGORY_LABELS[incident.category] ?? incident.category} (risk ${incident.riskScore}/100) — ${incident.externalId}`,
    ),
    `⚖️ ${awaiting.length} awaiting your decision`,
    `🦹 ${repeatOffenders.length} repeat offender${repeatOffenders.length === 1 ? "" : "s"} active`,
    ...repeatOffenders.slice(0, 3).map(
      (suspect) =>
        `   • ${suspect.handle} — ${suspect.incidentIds.length} incidents across ${suspect.platforms.length} platform${suspect.platforms.length === 1 ? "" : "s"}`,
    ),
    `📝 ${pendingProposals.length} policy proposal${pendingProposals.length === 1 ? "" : "s"} awaiting your review`,
    `✅ ${resolved.length} resolved · 🚫 ${dismissed.length} dismissed all-time`,
    "",
    "Open the dashboard to review: creaguard.sithunyein.com/app",
  ].join("\n");

  // Deliver to the configured chat, or fall back to the most recent chat
  // the bot has ever talked to so the digest always has a destination.
  let chatId = Number(process.env.DIGEST_TELEGRAM_CHAT_ID || 0);
  if (!chatId) {
    const fallback = incidents
      .map((incident) => incident.telegramChatId)
      .filter((id): id is number => typeof id === "number")
      .sort((a, b) => b - a)[0];
    chatId = fallback ?? 0;
  }

  if (!chatId) {
    return NextResponse.json({
      sent: false,
      reason: "No Telegram chat to deliver to — set DIGEST_TELEGRAM_CHAT_ID.",
      digest: lines,
    });
  }

  const messageId = await sendTelegramMessage(chatId, lines);
  return NextResponse.json({
    sent: Boolean(messageId),
    digest: lines,
    chatId,
  });
}