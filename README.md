# CreaGuard

> A persistent creator-safety product for threats, doxxing, impersonation, scams, and repeated harassment.

CreaGuard is a real, API-backed web application built for the **Moderation & Community Assistance** track of Creative Minds Jam #1. It gives solo creators and small communities a safety workspace that connects related incidents across time instead of moderating one message at a time.

## What it does

- **Review a message** — paste a community message and CreaGuard runs it through the analysis pipeline.
- **Real classification** — when `FEATHERLESS_API_KEY` is set, messages are classified through the Featherless API with strict JSON validation. Without the key, CreaGuard stores the case for manual review and never fabricates a result.
- **Persistent storage** — incidents and the safety policy are stored in Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured, with a file-backed store for local development.
- **Human-in-the-loop review** — cases move through `needs_review`, `monitoring`, `resolved`, and `dismissed`. Serious actions are never automated.
- **Risk scoring** — deterministic severity/confidence scoring with repetition weighting and follow-up scheduling.
- **Scheduled follow-ups** — `POST /api/followups` promotes due unresolved cases back to review (protect the endpoint with `CRON_SECRET`).
- **Minds relay** — with `MINDS_BUILDER_API_KEY` and `MINDS_MIND_ID`, a case can be relayed to a Mind through the official `@animocabrands/minds-client-lib`.

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
| `CRON_SECRET` | Bearer secret for the follow-up endpoint |

Legacy Vercel KV names (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) are also accepted for the Redis connection.

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Connection status for storage, Featherless, and Minds |
| `GET` | `/api/incidents` | List incidents |
| `POST` | `/api/incidents` | Analyze and create an incident |
| `GET` | `/api/incidents/[id]` | Get one incident |
| `PATCH` | `/api/incidents/[id]` | Update status, add a note, relay to Minds |
| `GET` / `PUT` | `/api/policy` | Read or save the safety policy |
| `POST` | `/api/followups` | Promote due unresolved cases (authenticated) |

## Architecture

```text
Community event
      ↓
CreaGuard backend (validation + redaction boundaries)
      ↓
Featherless classification (optional, strict JSON)
      ↓
Incident ledger (Upstash Redis / local file)
      ↓
Minds relay (optional, official client)
      ↓
Deterministic safety gates + human review
      ↓
Scheduled follow-up endpoint
```

### Responsibility split

- **Application database** — exact incidents, events, scores, statuses, and decisions.
- **Featherless** — bounded message-level classification and summarization.
- **Minds** — persistent agent relay for cross-session creator context.
- **Deterministic gates** — bans, reports, and evidence deletion are always blocked from automation.

## Safety boundaries

- Threat, doxxing, impersonation, and scam categories always require human review.
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
