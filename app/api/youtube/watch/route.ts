import { NextResponse } from "next/server";
import { getWatchedVideos, markVideoChecked } from "@/lib/store";
import { currentWorkspaceId } from "@/lib/workspace";
import { importVideoComments } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Autonomous YouTube watch: a scheduled cron re-checks every watched video
 * and imports + analyzes new comments — no creator needs to paste a URL.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube is not configured. Set YOUTUBE_API_KEY." },
      { status: 400 },
    );
  }

  const ws = await currentWorkspaceId();
  const videos = await getWatchedVideos(ws);
  if (videos.length === 0) {
    return NextResponse.json({ checked: 0, imported: 0, watched: 0 });
  }

  const results: Array<{
    videoId: string;
    title: string;
    fresh: number;
    analyzed: number;
    error?: string;
  }> = [];

  // Spread the budget across videos so a slow one can't starve the rest.
  const perVideoMs = Math.max(10_000, Math.floor(240_000 / videos.length));

  for (const video of videos) {
    try {
      const summary = await importVideoComments(apiKey, video.videoId, ws, perVideoMs);
      await markVideoChecked(ws, video.videoId);
      results.push({
        videoId: video.videoId,
        title: video.title,
        fresh: summary.fresh,
        analyzed: summary.analyzed,
      });
    } catch (error) {
      results.push({
        videoId: video.videoId,
        title: video.title,
        fresh: 0,
        analyzed: 0,
        error: error instanceof Error ? error.message.slice(0, 200) : "check failed",
      });
    }
  }

  const imported = results.reduce((sum, r) => sum + r.analyzed, 0);
  return NextResponse.json({
    watched: videos.length,
    checked: results.length,
    imported,
    results,
  });
}
