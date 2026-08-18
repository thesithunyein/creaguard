import { NextResponse } from "next/server";
import { processIncomingMessage } from "@/lib/intake";
import { dedupeSeen } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

/** Extracts a YouTube video id from common URL shapes and bare ids. */
function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
    /^([\w-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface CommentShape {
  id: string;
  author: string;
  text: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube is not configured. Set YOUTUBE_API_KEY." },
      { status: 400 },
    );
  }

  let body: { videoUrl?: unknown };
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

  // Pull top-level comments plus their replies in a single call.
  const res = await fetch(
    `${YOUTUBE_API}/commentThreads?part=snippet,replies&maxResults=100&textFormat=plainText&videoId=${videoId}&key=${apiKey}`,
  );
  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      {
        error: `YouTube API returned ${res.status}: ${detail.slice(0, 300)}`,
      },
      { status: 502 },
    );
  }
  const json = (await res.json()) as {
    items?: Array<{
      id?: string;
      snippet?: { topLevelComment?: { id?: string; snippet?: { authorDisplayName?: string; textDisplay?: string } } };
      replies?: { comments?: Array<{ id?: string; snippet?: { authorDisplayName?: string; textDisplay?: string } }> };
    }>;
  };

  const comments: CommentShape[] = [];
  for (const thread of json.items ?? []) {
    const top = thread.snippet?.topLevelComment;
    if (top?.snippet?.textDisplay) {
      comments.push({
        id: top.id ?? `yt:${videoId}:${comments.length}`,
        author: top.snippet.authorDisplayName ?? "YouTube user",
        text: top.snippet.textDisplay.trim(),
      });
    }
    for (const reply of thread.replies?.comments ?? []) {
      if (reply.snippet?.textDisplay) {
        comments.push({
          id: reply.id ?? `yt:${videoId}:reply:${comments.length}`,
          author: reply.snippet.authorDisplayName ?? "YouTube user",
          text: reply.snippet.textDisplay.trim(),
        });
      }
    }
  }

  // Only process comments we have not seen before.
  const fresh = await dedupeSeen("youtube", comments.map((c) => c.id));

  // Analysis is the slow part; process as many as fit in a short budget so
  // the request never times out. Re-running the same URL continues where it
  // left off because seen ids are remembered.
  const budgetMs = 20_000;
  const started = Date.now();
  let analyzed = 0;
  for (const id of fresh) {
    if (Date.now() - started > budgetMs) break;
    const comment = comments.find((c) => c.id === id);
    if (!comment) continue;
    await processIncomingMessage(comment.text, comment.author, "youtube");
    analyzed += 1;
  }

  return NextResponse.json({
    videoId,
    total: comments.length,
    fresh: fresh.length,
    analyzed,
    remaining: fresh.length - analyzed,
  });
}
