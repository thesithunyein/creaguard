import { NextResponse } from "next/server";
import { getIncident, getPolicy, saveIncident } from "@/lib/store";
import {
  fetchMindsReply,
  sendDecisionToMinds,
  sendToMinds,
} from "@/lib/minds";
import { postDecisionToTelegram } from "@/lib/channels";
import type { IncidentStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES: IncidentStatus[] = [
  "needs_review",
  "monitoring",
  "quarantined",
  "resolved",
  "dismissed",
];

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const incident = await getIncident(id);
  if (!incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  let minds = null;
  if (incident.mindsAlias) {
    if (incident.mindsReply) {
      // Cached — return instantly instead of re-querying the Mind.
      minds = { connected: true, reply: incident.mindsReply };
    } else {
      minds = await fetchMindsReply(incident);
      if (minds.reply) {
        incident.mindsReply = minds.reply;
        await saveIncident(incident);
      }
    }
  }

  return NextResponse.json({ incident, minds });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const incident = await getIncident(id);
  if (!incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      status?: unknown;
      decisionNote?: unknown;
      relayToMinds?: unknown;
      teachMind?: unknown;
    };
    const status = ALLOWED_STATUSES.includes(body.status as IncidentStatus)
      ? (body.status as IncidentStatus)
      : incident.status;
    const decisionNote =
      typeof body.decisionNote === "string" ? body.decisionNote.trim() : "";

    incident.status = status;
    incident.updatedAt = new Date().toISOString();
    if (decisionNote) incident.decisionNote = decisionNote;
    if (status === "resolved" || status === "dismissed") {
      delete incident.followUpAt;
    }

    await saveIncident(incident);

    let minds = null;
    const terminalDecision =
      status === "resolved" || status === "dismissed";
    if (body.relayToMinds === true) {
      // Relay the case to the Mind for review.
      const policy = await getPolicy();
      minds = await sendToMinds(policy, incident);
      if (minds.alias) {
        incident.mindsAlias = minds.alias;
        await saveIncident(incident);
      }
    } else if (decisionNote && terminalDecision && body.teachMind !== false) {
      // Feedback loop: the creator's terminal decision is sent back to
      // the Mind so it learns their standards for similar cases.
      const policy = await getPolicy();
      minds = await sendDecisionToMinds(policy, incident, decisionNote);
    }

    // Post the decision back to the source channel so the loop is visible
    // there too (Telegram today; Discord/YouTube are one-way intakes).
    const channelPostedBack = terminalDecision
      ? await postDecisionToTelegram(incident, status, decisionNote)
      : false;

    return NextResponse.json({ incident, minds, channelPostedBack });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
}
