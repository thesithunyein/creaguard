import { NextResponse } from "next/server";
import { processIncomingMessage } from "@/lib/intake";
import { dedupeSeen } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.instagram.com/v21.0";

/**
 * Instagram comment intake. Instagram has no push webhook for comments,
 * so CreaGuard polls: latest media -> their comments -> shared pipeline.
 * Point a cron at POST /api/instagram (Bearer $CRON_SECRET) for autonomy.
 */

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN),
    note: "POST to this endpoint to poll new comments.",
  });
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Instagram is not configured. Set INSTAGRAM_ACCESS_TOKEN." },
      { status: 400 },
    );
  }

  // 1. Recent media on the connected creator account.
  const mediaRes = await fetch(
    `${GRAPH}/me/media?fields=id,caption,timestamp&limit=10&access_token=${token}`,
  );
  if (!mediaRes.ok) {
    const detail = await mediaRes.text();
    return NextResponse.json(
      { error: `Instagram media request failed (${mediaRes.status}): ${detail.slice(0, 300)}` },
      { status: 502 },
    );
  }
  const mediaJson = (await mediaRes.json()) as {
    data?: Array<{ id?: string }>;
  };
  const mediaIds = (mediaJson.data ?? []).map((item) => item.id).filter(Boolean);

  // 2. Comments across those posts.
  const comments: Array<{ id: string; author: string; text: string }> = [];
  for (const mediaId of mediaIds) {
    const res = await fetch(
      `${GRAPH}/${mediaId}/comments?fields=id,text,username&limit=50&access_token=${token}`,
    );
    if (!res.ok) continue;
    const json = (await res.json()) as {
      data?: Array<{ id?: string; text?: string; username?: string }>;
    };
    for (const comment of json.data ?? []) {
      if (!comment.id || !comment.text) continue;
      comments.push({
        id: comment.id,
        author: comment.username ?? "Instagram user",
        text: comment.text.trim(),
      });
    }
  }

  // 3. Only process comments we have not seen before.
  const fresh = await dedupeSeen("instagram", comments.map((c) => c.id));

  // 4. Analyze with a time budget; re-polls continue where it left off.
  const budgetMs = 20_000;
  const started = Date.now();
  let analyzed = 0;
  for (const id of fresh) {
    if (Date.now() - started > budgetMs) break;
    const comment = comments.find((c) => c.id === id);
    if (!comment) continue;
    await processIncomingMessage(comment.text, comment.author, "instagram");
    analyzed += 1;
  }

  return NextResponse.json({
    mediaScanned: mediaIds.length,
    total: comments.length,
    fresh: fresh.length,
    analyzed,
    remaining: fresh.length - analyzed,
  });
}
