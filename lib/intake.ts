import { analyzeMessage } from "./analyze";
import { newId } from "./ids";
import { sendToMinds } from "./minds";
import {
  computeFollowUpAt,
  computeRisk,
  requiresHumanReview,
  shouldAutoQuarantine,
} from "./risk";
import { getIncidents, getPolicy, saveIncident } from "./store";
import type { Incident, IncidentEvent, IncidentStatus } from "./types";

/**
 * Shared intake pipeline for every channel (manual paste, Discord,
 * Telegram): analyze -> risk score -> auto-handling tier -> store ->
 * autonomous Mind relay for high-risk cases.
 */
export async function processIncomingMessage(
  message: string,
  authorId: string,
  platform: string,
): Promise<{ incident: Incident; status: IncidentStatus; relatedCount: number }> {
  const classification = await analyzeMessage(message, authorId);
  const existing = await getIncidents();
  const related = existing.filter(
    (item) =>
      authorId && item.events.some((event) => event.authorId === authorId),
  );

  // Auto-handling tiers:
  // - green/yellow (criticism, low risk) -> monitoring (silent, digest only)
  // - red (threats, doxxing, impersonation, severity >= 4) -> needs_review
  // - black (obvious scam, high confidence) -> quarantined automatically
  const status: IncidentStatus = shouldAutoQuarantine(classification)
    ? "quarantined"
    : requiresHumanReview(classification)
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
    platform,
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

  // Autonomous follow-up: high-risk messages are relayed to the Mind the
  // moment they arrive — no human click required.
  if (status === "needs_review") {
    const policy = await getPolicy();
    const relay = await sendToMinds(policy, incident);
    if (relay.alias) {
      incident.mindsAlias = relay.alias;
      await saveIncident(incident);
    }
  }

  return { incident, status, relatedCount: related.length };
}
