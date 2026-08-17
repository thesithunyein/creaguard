import { NextResponse } from "next/server";
import { followUpToMinds } from "@/lib/minds";
import { getIncidents, getPolicy, saveIncident } from "@/lib/store";

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

  const policy = await getPolicy();
  const processed = [];
  for (const incident of due) {
    // Autonomous follow-up: the Mind re-reviews the open case and recommends
    // the next step without a human prompting it.
    const result = await followUpToMinds(policy, incident);

    incident.status = "needs_review";
    incident.updatedAt = now.toISOString();
    delete incident.followUpAt;
    if (result.alias) incident.mindsAlias = result.alias;
    await saveIncident(incident);

    processed.push({
      id: incident.id,
      externalId: incident.externalId,
      mindsRelayed: result.connected,
    });
  }

  return NextResponse.json({ processed, count: processed.length });
}
