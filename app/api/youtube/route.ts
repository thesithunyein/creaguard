import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import {
  addWatchedVideo,
  getWatchedVideos,
  recordChannelPing,
  removeWatchedVideo,
} from "@/lib/store";
import { currentWorkspaceId } from "@/lib/workspace";
import { fetchVideoTitle, importVideoComments, parseVideoId } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await currentWorkspaceId();
  const videos = await getWatchedVideos(ws);
  return NextResponse.json({ videos });
}

export async function POST(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube is not configured. Set YOUTUBE_API_KEY." },
      { status: 400 },
    );
  }

  let body: { videoUrl?: unknown; watch?: unknown; unwatch?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl : "";
  const videoId = parseVideoId(videoUrl);
  if (!videoId) {
    return NextResponse.json(
      { error: "Could not read a YouTube video id from that URL." },
      { status: 400 },
    );
  }

  const ws = await currentWorkspaceId();

  // Unwatch: just remove it from the watched list.
  if (body.unwatch === true) {
    const videos = await removeWatchedVideo(ws, videoId);
    return NextResponse.json({ videoId, watched: false, watchedCount: videos.length });
  }

  let summary: { total: number; fresh: number; analyzed: number; remaining: number };
  try {
    summary = await importVideoComments(apiKey, videoId, ws);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "YouTube import failed." },
      { status: 502 },
    );
  }

  // A successful import proves YouTube is connected — the connect wizard
  // counts it even if every comment was already seen.
  waitUntil(recordChannelPing(ws, "youtube").catch(() => undefined));

  // Watch: remember the video so a scheduled cron keeps checking it.
  let watched = false;
  let watchedCount = 0;
  if (body.watch === true) {
    const title = await fetchVideoTitle(apiKey, videoId);
    const videos = await addWatchedVideo(ws, {
      videoId,
      title,
      url: `https://youtube.com/watch?v=${videoId}`,
      addedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    });
    watched = true;
    watchedCount = videos.length;
  }

  return NextResponse.json({ videoId, watched, watchedCount, ...summary });
}
