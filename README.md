# CreaGuard

> A persistent safety Mind for creators.

CreaGuard is a creator-safety product for solo creators and small online communities. It helps identify escalating threats, doxxing, impersonation, scams, and repeated harassment while keeping serious actions under human control.

This repository currently contains a polished, zero-cost interactive MVP demo. It demonstrates the intended product experience with realistic seeded incidents. The next integration phase connects the live workflow to Minds and Featherless.

## Why this product

A keyword filter sees one message. CreaGuard remembers the creator's boundaries and connects incidents over time:

- Normal criticism is not automatically punished.
- Threats and doxxing are escalated for immediate human review.
- Repeated targeting becomes one connected incident.
- Unresolved cases receive an autonomous follow-up.

**Differentiation:** general moderation tools protect the community; CreaGuard protects the creator.

## Run the demo

This first version has no build step or paid dependency. Open `index.html` in a browser, or serve the folder with any static file server:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173`.

The demo includes:

- Overview dashboard
- Incident inbox
- Incident detail drawer
- Creator safety policy editor
- Mind activity timeline
- Simulated incoming event
- Human approval and monitoring actions

## Intended production architecture

```text
Community event / webhook
          ↓
CreaGuard backend + redaction
          ↓
Featherless classifier
          ↓
Incident ledger (exact records)
          ↓
Minds persistent reasoning
          ↓
Deterministic safety gate
          ↓
Creator dashboard + approval
          ↓
Due-case scheduler → Minds follow-up
```

### Responsibility split

- **Minds:** creator policy memory, cross-session reasoning, case continuity, follow-up conversation.
- **Featherless:** bounded message analysis, risk classification, summaries, and draft responses.
- **Application database:** exact incident IDs, timestamps, statuses, scores, decisions, and audit history.
- **Safety gate:** prevents automatic bans, deletion, public accusations, or emergency claims.

The production integration should use the official server-side `@animocabrands/minds-client-lib`. Before claiming native autonomous scheduling, verify the supported Minds trigger flow with the Minds team. The UI must never expose API keys.

## Hackathon fit

CreaGuard targets **Moderation & Community Assistance** and is designed to demonstrate:

1. Memory — the Mind remembers creator boundaries.
2. Continuity — related incidents continue across sessions.
3. Autonomous follow-up — due unresolved cases are reviewed without a manual “run” action.
4. Creator-economy fit — creators need affordable, context-aware safety support.

## Safety boundaries

- Threat and doxxing signals require immediate human review.
- Bans, deletions, reporting, and public responses require explicit approval.
- Evidence is preserved rather than silently deleted.
- The classifier is advisory; it is not an emergency-response service.
- Sensitive message data should be redacted or minimized before storage.

## Roadmap

1. Prove Minds messaging and cross-session memory with the official client.
2. Connect Featherless with validated structured JSON output.
3. Add SQLite incident ledger and deterministic risk gates.
4. Implement the due-case Minds follow-up flow.
5. Add a real Discord or Telegram test integration only after the local flow is reliable.
6. Deploy a free-tier live site and record the required 1.5–2 minute demo.
