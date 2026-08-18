# <img src="public/logo.png" width="28" height="28" alt="CreaGuard logo" /> CreaGuard

> A persistent creator-safety product for threats, doxxing, impersonation, scams, and repeated harassment.

CreaGuard is a real, API-backed web application built for the **Moderation & Community Assistance** track of Creative Minds Jam #1. It gives solo creators and small communities a safety workspace that connects related incidents across time instead of moderating one message at a time.

## What it does

- **Review a message** — paste a community message and CreaGuard runs it through the analysis pipeline.
- **Real classification** — when `FEATHERLESS_API_KEY` is set, messages are classified through the Featherless API with strict JSON validation. Without the key, CreaGuard stores the case for manual review and never fabricates a result.
- **Persistent storage** — incidents and the safety policy are stored in Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured, with a file-backed store for local development.
- **Human-in-the-loop review** — cases move through `needs_review`, `monitoring`, `resolved`, and `dismissed`. Serious actions are never automated.
- **Auto-quarantine tier** — obvious scams with high confidence are quarantined automatically: hidden from the main queue so busy creators never see obvious spam, but still reviewable and restorable.
- **Risk scoring** — deterministic severity/confidence scoring with repetition weighting and follow-up scheduling.
- **Scheduled follow-ups** — `POST /api/followups` promotes due unresolved cases back to review (protect the endpoint with `CRON_SECRET`).
- **Minds relay** — with `MINDS_BUILDER_API_KEY` and `MINDS_MIND_ID`, a case is relayed to your Mind through the official `@animocabrands/minds-client-lib`. The relay is non-blocking: the case is sent immediately, the conversation alias is stored on the incident, and the Mind's reply is read back from conversation history into a live **Mind review** panel in the case drawer. This proves cross-session memory and continuity: the Mind sees every prior case in the same conversation.
- **Decision feedback loop** — when you resolve or dismiss a case with a decision note, the note is sent back to your Mind as the creator's standard for similar cases. The Mind needs less human input over time.
- **Multi-channel intake** — every channel funnels into one shared pipeline (`lib/intake.ts`): manual paste, Discord `/review`, Telegram bot messages, Twitch chat via EventSub webhooks, YouTube comments imported from a video link, and Instagram comments polled from the Graph API. Platform differences are intake only — analysis, risk, quarantine, and the Mind are identical everywhere.

## Stack

- Next.js 15 (App Router, serverless API routes)
- React 19 + TypeScript
- Upstash Redis (`@upstash/redis`)
- Featherless (OpenAI-compatible API)
- `@animocabrands/minds-client-lib`

## Local development

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

Open `http://localhost:4173`.

Without any environment variables, the app runs with a local file store and manual review mode. The UI reports its real connection state in **Settings**.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Durable incident and policy storage |
| `FEATHERLESS_API_KEY` | Real message classification |
| `FEATHERLESS_MODEL` | Optional model override (default `Qwen/Qwen2.5-7B-Instruct`) |
| `MINDS_BUILDER_API_KEY` / `MINDS_MIND_ID` | Relay cases to a Minds agent |
| `CRON_SECRET` | Bearer secret for the follow-up and Instagram poll endpoints |
| `DISCORD_BOT_TOKEN` / `DISCORD_APPLICATION_ID` / `DISCORD_PUBLIC_KEY` | Discord `/review` slash command |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_SECRET` | Telegram bot webhook (run `scripts/setup-telegram.mjs`) |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` / `TWITCH_EVENTSUB_SECRET` | Twitch chat EventSub webhooks (run `scripts/setup-twitch.mjs`) |
| `YOUTUBE_API_KEY` | YouTube video-URL comment import |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram comment polling (Business/Creator account) |

Legacy Vercel KV names (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) are also accepted for the Redis connection.

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Connection status for storage, Featherless, and Minds |
| `GET` | `/api/incidents` | List incidents |
| `POST` | `/api/incidents` | Analyze and create an incident |
| `GET` | `/api/incidents/[id]` | Get one incident |
| `PATCH` | `/api/incidents/[id]` | Update status, add a note, relay to Minds, or teach the Mind a decision |
| `GET` / `PUT` | `/api/policy` | Read or save the safety policy |
| `POST` | `/api/followups` | Promote due unresolved cases (authenticated) |
| `POST` | `/api/telegram` | Telegram bot webhook (set via `scripts/setup-telegram.mjs`) |
| `GET` / `POST` | `/api/twitch/eventsub` | Twitch EventSub challenge + chat events |
| `POST` | `/api/youtube` | Import and analyze comments of a YouTube video URL |
| `GET` / `POST` | `/api/instagram` | Poll Instagram comments (manual or cron, authenticated) |

## Architecture

```text
Discord /review · Telegram bot · Twitch chat · YouTube video URL · Instagram poll · manual paste
      ↓
Shared intake pipeline (lib/intake.ts): analyze → risk score → auto-handling tier → store
      ↓
Featherless classification (optional, strict JSON)
      ↓
Incident ledger (Upstash Redis / local file)
      ↓
Minds relay (optional, official client) → reply read back into the case drawer
      ↓
Deterministic safety gates + human review
      ↓
Creator decision → sent back to the Mind (feedback loop)
      ↓
Scheduled follow-up endpoint
```

## Connecting channels

Each channel is optional and reports its real connection state in **Settings**. Set the env vars above, deploy, then run the setup scripts:

```bash
# Discord: create a bot + slash command in the Developer Portal (no script needed)

# Telegram: create a bot with @BotFather, then point it at the deployed app
TELEGRAM_BOT_TOKEN=... TELEGRAM_BOT_SECRET=... \
TELEGRAM_WEBHOOK_URL=https://your-app.vercel.app/api/telegram \
node scripts/setup-telegram.mjs

# Twitch: create an app at dev.twitch.tv, authorize your channel, subscribe to chat
TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=... TWITCH_EVENTSUB_SECRET=... \
TWITCH_WEBHOOK_URL=https://your-app.vercel.app/api/twitch/eventsub \
node scripts/setup-twitch.mjs

# YouTube: paste a video URL on the Incidents page (YOUTUBE_API_KEY only)
# Instagram: set INSTAGRAM_ACCESS_TOKEN, then POST /api/instagram (cron or manual)
```

Twitch and Instagram deliveries are deduplicated by message/comment id, so redelivered webhooks and repeated polls never create duplicate incidents. Imports and polls run on a short time budget and continue where they left off on the next call.

### Responsibility split

- **Application database** — exact incidents, events, scores, statuses, and decisions.
- **Featherless** — bounded message-level classification and summarization.
- **Minds** — persistent agent relay for cross-session creator context.
- **Deterministic gates** — bans, reports, and evidence deletion are always blocked from automation.

## Safety boundaries

- Threat, doxxing, impersonation, and scam categories always require human review — except obvious scams with ≥90% confidence, which are quarantined (hidden, never deleted or acted on).
- Severity 4+ requires human review.
- Automatic bans, automatic reporting, and evidence deletion are hard-blocked.
- The classifier is advisory; it is not an emergency-response service.
- Sensitive message content should be redacted or minimized before being stored in production.

## Why this is a real product, not a demo

- No seeded incidents: the workspace starts empty and fills from real API calls.
- Every screen is backed by a live API route.
- Missing credentials produce an explicit `not configured` state instead of a fabricated AI result.
- Storage, analysis, and Minds integration are each independently verifiable in the Settings screen.

## Deployment

```bash
vercel --prod
```

Set the environment variables above in the Vercel project settings. For the scheduled follow-up, point a cron provider at `POST /api/followups` with `Authorization: Bearer $CRON_SECRET`.
