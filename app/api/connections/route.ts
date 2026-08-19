import { NextResponse } from "next/server";
import {
  getConnections,
  getIncidents,
  saveConnections,
} from "@/lib/store";
import { currentWorkspaceId } from "@/lib/workspace";
import type { ChannelName, Connections } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_CHANNELS: ChannelName[] = ["telegram", "discord", "youtube"];

/**
 * Returns the workspace's connected channels. Auto-detects any channel
 * that has delivered at least one case — if the bot posted an incident,
 * the channel is demonstrably connected, so the wizard flips it to
 * "Connected" without the creator doing anything else.
 */
export async function GET() {
  const ws = await currentWorkspaceId();
  const connections = await getConnections(ws);
  const incidents = await getIncidents(ws);

  const detected = new Set<ChannelName>(connections.platforms);
  for (const incident of incidents) {
    const platform = incident.events.at(-1)?.platform;
    if (
      platform === "telegram" ||
      platform === "discord" ||
      platform === "youtube"
    ) {
      detected.add(platform);
    }
  }

  const updated: Connections = {
    platforms: ALL_CHANNELS.filter((channel) => detected.has(channel)),
    onboardingDone: connections.onboardingDone,
  };
  if (
    updated.platforms.length !== connections.platforms.length ||
    updated.onboardingDone !== connections.onboardingDone
  ) {
    await saveConnections(ws, updated);
  }
  return NextResponse.json({ connections: updated });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      platforms?: unknown;
      onboardingDone?: unknown;
    };
    const ws = await currentWorkspaceId();
    const current = await getConnections(ws);

    let platforms = current.platforms;
    if (Array.isArray(body.platforms)) {
      platforms = body.platforms.filter(
        (item): item is ChannelName =>
          item === "telegram" || item === "discord" || item === "youtube",
      );
    }
    const onboardingDone =
      typeof body.onboardingDone === "boolean"
        ? body.onboardingDone
        : current.onboardingDone;

    const connections: Connections = { platforms, onboardingDone };
    await saveConnections(ws, connections);
    return NextResponse.json({ connections });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
