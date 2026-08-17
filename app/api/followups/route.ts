import { NextResponse } from "next/server";
import { getIncidents, saveIncident } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const now = new Date();
  const incidents = await getIncidents();
  const due = incidents.filter(
    (incident) =>
      incident.followUpAt &&
      new Date(incident.followUpAt).getTime() <= now.getTime() &&
      incident.status !== "resolved" &&
      incident.status !== "dismissed",
  );

  const processed = [];
  for (const incident of due) {
    incident.status = "needs_review";
    incident.updatedAt = now.toISOString();
    delete incident.followUpAt;
    await saveIncident(incident);
    processed.push({ id: incident.id, externalId: incident.externalId });
  }

  return NextResponse.json({ processed, count: processed.length });
}
