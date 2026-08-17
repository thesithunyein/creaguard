import type { Incident, Policy } from "./types";

export interface MindsResult {
  connected: boolean;
  message?: string;
  error?: string;
}

export async function sendToMinds(
  policy: Policy,
  incident: Incident,
): Promise<MindsResult> {
  const apiKey = process.env.MINDS_BUILDER_API_KEY;
  const mindId = process.env.MINDS_MIND_ID;
  if (!apiKey || !mindId) {
    return {
      connected: false,
      message:
        "Minds is not configured yet. CreaGuard stored the case locally and will relay it once the Builder API key is connected.",
    };
  }

  try {
    const { createMindsClient, BUILDER_API_KEY_ENV } = await import(
      "@animocabrands/minds-client-lib"
    );
    process.env[BUILDER_API_KEY_ENV] = apiKey;
    const client = createMindsClient({ builderApiKey: apiKey });

    const alias = `creaguard-incident-${incident.externalId}`;
    await client.ensureConversation(alias, mindId);

    const latest = incident.events.at(-1);
    const message = [
      `Creator safety case ${incident.externalId}`,
      `Policy: ${policy.content}`,
      `Classification: ${incident.category}, severity ${incident.severity}, confidence ${latest?.classification?.confidence ?? 0}`,
      `Message: ${latest?.message ?? ""}`,
      `Recommendation: ${latest?.classification?.recommendedAction ?? "Manual review"}`,
    ].join("\n");

    await client.sendMessage({ alias, messageText: message });
    const outcome = await client.waitForReply({
      alias,
      timeoutMs: 120_000,
      sentMessageText: message,
    });

    return {
      connected: true,
      message: outcome.timedOut
        ? "Minds connected, but no reply arrived within the timeout."
        : `Minds reply: ${(outcome.reply.messageText ?? "(no text)").slice(0, 500)}`,
    };
  } catch (error) {
    return {
      connected: true,
      error: error instanceof Error ? error.message : "Minds request failed.",
    };
  }
}
