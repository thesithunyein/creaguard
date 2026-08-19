import { processIncomingMessage } from "@/lib/intake";
import { dedupeSeen } from "@/lib/store";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

/** Extracts a YouTube video id from common URL shapes and bare ids. */
export function parseVideoId(input: string): string | null {
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

/** Fetches a video's title (for the watched-videos list) or a fallback. */
export async function fetchVideoTitle(
  apiKey: string,
  videoId: string,
): Promise<string> {
  try {
    const res = await fetch(
      `${YOUTUBE_API}/videos?part=snippet&id=${videoId}&key=${apiKey}`,
    );
    if (res.ok) {
      const json = (await res.json()) as {
        items?: Array<{ snippet?: { title?: string } }>;
      };
      const title = json.items?.[0]?.snippet?.title;
      if (title) return title;
    }
  } catch {
    // fall through to the generic label
  }
  return `YouTube video ${videoId}`;
}

interface CommentShape {
  id: string;
  author: string;
  text: string;
}

/** Imports + analyzes fresh comments for one video. Returns a summary. */
export async function importVideoComments(
  apiKey: string,
  videoId: string,
  workspaceId: string,
  budgetMs = 20_000,
): Promise<{ total: number; fresh: number; analyzed: number; remaining: number }> {
  const res = await fetch(
    `${YOUTUBE_API}/commentThreads?part=snippet,replies&maxResults=100&textFormat=plainText&videoId=${videoId}&key=${apiKey}`,
  );
  if (!res.ok) {
    throw new Error(`YouTube API returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
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

  const fresh = await dedupeSeen(workspaceId, "youtube", comments.map((c) => c.id));

  // Analysis is the slow part; process as many as fit in the budget so the
  // request never times out. Re-running the same URL continues where it left
  // off because seen ids are remembered.
  const started = Date.now();
  let analyzed = 0;
  for (const id of fresh) {
    if (Date.now() - started > budgetMs) break;
    const comment = comments.find((c) => c.id === id);
    if (!comment) continue;
    await processIncomingMessage(workspaceId, comment.text, comment.author, "youtube");
    analyzed += 1;
  }

  return { total: comments.length, fresh: fresh.length, analyzed, remaining: fresh.length - analyzed };
}
