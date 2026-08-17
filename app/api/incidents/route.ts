import { NextResponse } from "next/server";
import { analyzeMessage } from "@/lib/analyze";
import { newId } from "@/lib/ids";
import { computeFollowUpAt, computeRisk, requiresHumanReview } from "@/lib/risk";
import { getIncidents, saveIncident } from "@/lib/store";
import type { Incident, IncidentEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const incidents = await getIncidents();
  return NextResponse.json({ incidents });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: unknown;
      authorId?: unknown;
      platform?: unknown;
    };

    const message =
      typeof body.message === "string" ? body.message.trim() : "";
    const authorId =
      typeof body.authorId === "string" ? body.authorId.trim() : "";
    const platform =
      typeof body.platform === "string" ? body.platform.trim() : "manual";

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }
    if (message.length > 4000) {
      return NextResponse.json(
        { error: "Message is too long." },
        { status: 400 },
      );
    }

    const classification = await analyzeMessage(message, authorId);
    const existing = await getIncidents();
    const related = existing.filter(
      (item) =>
        authorId &&
        item.events.some((event) => event.authorId === authorId),
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

    return NextResponse.json(
      { incident, relatedCount: related.length },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process incident.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
