import { NextResponse } from "next/server";
import { processIncomingMessage } from "@/lib/intake";
import { getIncidents } from "@/lib/store";
import { currentWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const incidents = await getIncidents(await currentWorkspaceId());
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

    const { incident, status, relatedCount } = await processIncomingMessage(
      await currentWorkspaceId(),
      message,
      authorId,
      platform,
    );

    const mindsRelayed = Boolean(incident.mindsAlias);

    return NextResponse.json(
      { incident, status, relatedCount, mindsRelayed },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process incident.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
