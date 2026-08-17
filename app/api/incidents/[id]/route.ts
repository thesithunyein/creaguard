import { NextResponse } from "next/server";
import { getIncident, getPolicy, saveIncident } from "@/lib/store";
import { sendToMinds } from "@/lib/minds";
import type { IncidentStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES: IncidentStatus[] = [
  "needs_review",
  "monitoring",
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
  return NextResponse.json({ incident });
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
    if (body.relayToMinds === true) {
      const policy = await getPolicy();
      minds = await sendToMinds(policy, incident);
    }

    return NextResponse.json({ incident, minds });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
}
