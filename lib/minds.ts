import type { Incident, Policy } from "./types";

export interface MindsResult {
  connected: boolean;
  alias?: string;
  message?: string;
  error?: string;
}

export interface MindsReplyResult {
  connected: boolean;
  reply?: string;
  error?: string;
}

function mindsConfig() {
  const apiKey = process.env.MINDS_BUILDER_API_KEY;
  const mindId = process.env.MINDS_MIND_ID;
  return apiKey && mindId ? { apiKey, mindId } : null;
}

async function mindsClient() {
  const { createMindsClient } = await import("@animocabrands/minds-client-lib");
  const config = mindsConfig();
  if (!config) throw new Error("Minds is not configured.");
  return createMindsClient({ builderApiKey: config.apiKey });
}

export function incidentAlias(incident: Incident): string {
  return `creaguard-incident-${incident.externalId}`;
}

/**
 * Relays the case to the creator's Mind and returns immediately.
 * The Mind's reply is retrieved later via fetchMindsReply so the
 * request does not block inside a serverless function.
 */
export async function sendToMinds(
  policy: Policy,
  incident: Incident,
): Promise<MindsResult> {
  if (!mindsConfig()) {
    return {
      connected: false,
      message:
        "Minds is not configured yet. CreaGuard stored the case locally and will relay it once the Builder API key is connected.",
    };
  }

  try {
    const client = await mindsClient();
    const config = mindsConfig();
    if (!config) return { connected: false, message: "Minds is not configured." };

    const alias = incidentAlias(incident);
    await client.ensureConversation(alias, config.mindId);

    const latest = incident.events.at(-1);
    const message = [
      `Creator safety case ${incident.externalId}`,
      `Policy: ${policy.content}`,
      `Classification: ${incident.category}, severity ${incident.severity}, confidence ${latest?.classification?.confidence ?? 0}`,
      `Message: ${latest?.message ?? ""}`,
      `Recommendation: ${latest?.classification?.recommendedAction ?? "Manual review"}`,
    ].join("\n");

    await client.sendMessage({ alias, messageText: message });

    return {
      connected: true,
      alias,
      message: `Case relayed to your Mind. Its reply will appear here shortly.`,
    };
  } catch (error) {
    return {
      connected: true,
      error: error instanceof Error ? error.message : "Minds request failed.",
    };
  }
}

/**
 * Sends an autonomous follow-up message to the Mind for an unresolved case,
 * asking it to recommend the next step. Used by the scheduled cron so the
 * Mind keeps working without a human clicking anything.
 */
export async function followUpToMinds(
  policy: Policy,
  incident: Incident,
): Promise<MindsResult> {
  if (!mindsConfig()) {
    return { connected: false, message: "Minds is not configured." };
  }

  try {
    const client = await mindsClient();
    const config = mindsConfig();
    if (!config) return { connected: false, message: "Minds is not configured." };

    const alias = incident.mindsAlias ?? incidentAlias(incident);
    await client.ensureConversation(alias, config.mindId);

    const message = [
      `Autonomous follow-up for ${incident.externalId}`,
      `This case is still unresolved and needs a decision.`,
      `Status: ${incident.status}, category ${incident.category}, risk ${incident.riskScore}/100.`,
      `Policy: ${policy.content}`,
      `What should the creator do next? Recommend a single action; the creator will approve it.`,
    ].join("\n");

    await client.sendMessage({ alias, messageText: message });

    return { connected: true, alias, message: "Follow-up sent to your Mind." };
  } catch (error) {
    return {
      connected: true,
      error: error instanceof Error ? error.message : "Minds follow-up failed.",
    };
  }
}

/**
 * Sends the creator's decision back to the Mind so it learns the
 * creator's standards. This is the feedback loop that makes the Mind
 * need less human input over time.
 */
export async function sendDecisionToMinds(
  policy: Policy,
  incident: Incident,
  decision: string,
): Promise<MindsResult> {
  if (!mindsConfig()) {
    return { connected: false, message: "Minds is not configured." };
  }

  try {
    const client = await mindsClient();
    const config = mindsConfig();
    if (!config) return { connected: false, message: "Minds is not configured." };

    const alias = incident.mindsAlias ?? incidentAlias(incident);
    await client.ensureConversation(alias, config.mindId);

    const latest = incident.events.at(-1);
    const message = [
      `Creator decision for ${incident.externalId}: ${decision}`,
      `Category ${incident.category}, severity ${incident.severity}, risk ${incident.riskScore}/100.`,
      `Message: ${latest?.message ?? ""}`,
      `Policy: ${policy.content}`,
      `Remember this decision as the creator's standard for similar cases.`,
    ].join("\n");

    await client.sendMessage({ alias, messageText: message });

    return { connected: true, alias, message: "Decision sent to your Mind." };
  } catch (error) {
    return {
      connected: true,
      error: error instanceof Error ? error.message : "Minds decision feedback failed.",
    };
  }
}

/**
 * Reads the latest reply from the creator's Mind in the conversation
 * history for this incident. Uses senderType (0|2 = Mind, 1 = human).
 */
export async function fetchMindsReply(
  incident: Incident,
): Promise<MindsReplyResult> {
  if (!mindsConfig()) {
    return { connected: false, error: "Minds is not configured." };
  }

  try {
    const client = await mindsClient();
    const history = await client.getHistory(incidentAlias(incident), {
      limit: 20,
    });
    const mindMessages = history.filter(
      (row) => row.senderType === 0 || row.senderType === 2,
    );
    const latest = mindMessages.at(-1);
    return {
      connected: true,
      reply: latest?.messageText?.trim()
        ? latest.messageText.trim()
        : undefined,
    };
  } catch (error) {
    return {
      connected: true,
      error: error instanceof Error ? error.message : "Failed to read Minds reply.",
    };
  }
}
