import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getChannelPings,
  getConnections,
  getIncidents,
  saveConnections,
} from "@/lib/store";
import { clerkEnabled, currentWorkspaceId } from "@/lib/workspace";
import type { ChannelName, Connections } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_CHANNELS: ChannelName[] = ["telegram", "discord", "youtube"];

/**
 * Connection state is per signed-in user, so a brand-new account starts at
 * 0/3 and must actually complete each channel's step. Anonymous traffic
 * (and the shared demo) falls back to the workspace scope.
 */
async function connectionsScope(): Promise<string> {
  if (clerkEnabled()) {
    try {
      const { userId } = await auth();
      if (userId) return `user:${userId}`;
    } catch {
      /* fall through to workspace scope */
    }
  }
  return `ws:${await currentWorkspaceId()}`;
}

/**
 * Returns the user's connected channels. A channel only counts when a case
 * from it arrived AFTER the wizard was opened — so pre-existing demo data
 * never makes a new account look already connected.
 */
export async function GET() {
  const scope = await connectionsScope();
  const connections = await getConnections(scope);
  if (!connections.wizardStartedAt) {
    return NextResponse.json({ connections });
  }

  const ws = await currentWorkspaceId();
  const incidents = await getIncidents(ws);
  const pings = await getChannelPings(ws);
  const startedAt = new Date(connections.wizardStartedAt).getTime();
  const detected = new Set<ChannelName>(connections.platforms);

  // A channel counts as connected when a NEW case arrived after the wizard
  // opened OR the bot heard from the creator (any message — even /start,
  // which creates no case).
  for (const channel of ALL_CHANNELS) {
    const ping = pings[channel];
    if (ping && new Date(ping).getTime() >= startedAt) {
      detected.add(channel);
    }
  }
  for (const incident of incidents) {
    const platform = incident.events.at(-1)?.platform;
    if (
      (platform === "telegram" ||
        platform === "discord" ||
        platform === "youtube") &&
      new Date(incident.createdAt).getTime() >= startedAt
    ) {
      detected.add(platform);
    }
  }

  const updated: Connections = {
    ...connections,
    platforms: ALL_CHANNELS.filter((channel) => detected.has(channel)),
  };
  if (updated.platforms.length !== connections.platforms.length) {
    await saveConnections(scope, updated);
  }
  return NextResponse.json({ connections: updated });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      platforms?: unknown;
      onboardingDone?: unknown;
      wizardStartedAt?: unknown;
    };
    const scope = await connectionsScope();
    const current = await getConnections(scope);

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
    const wizardStartedAt =
      typeof body.wizardStartedAt === "string"
        ? body.wizardStartedAt
        : current.wizardStartedAt;

    const connections: Connections = {
      platforms,
      onboardingDone,
      wizardStartedAt,
    };
    await saveConnections(scope, connections);
    return NextResponse.json({ connections });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
