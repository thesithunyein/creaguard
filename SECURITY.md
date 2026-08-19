# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| main    | ✅                 |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.** Send a
private report instead:

- Open a [private vulnerability report](https://github.com/thesithunyein/creaguard/security/advisories/new) on GitHub, or
- Email the repository owner directly (see commit history for the address).

You should receive a response within 48 hours. If the issue is confirmed, a
fix is released as soon as possible and coordinated disclosure is offered.

## Product safety boundaries

CreaGuard is a safety tool, so it enforces hard limits in code:

- **No automatic bans, blocks, or reports** — enforcement always requires an
  explicit human-confirmed click.
- **No automatic evidence deletion** — every incident, event, and decision is
  retained as an audit trail.
- **No fabricated results** — when an analysis backend or Minds key is missing,
  the app reports `not configured` instead of inventing a classification.
- **Server-side secrets only** — API keys (Featherless, Minds, Discord,
  Telegram, YouTube, Upstash) are read from the server environment and never
  shipped to the browser.

## Data handling

- Incident content may contain sensitive or harassing material. In
  production, store only what your safety workflow requires and apply
  retention limits appropriate to your jurisdiction.
- Per-creator workspaces isolate incidents between signed-in accounts; channel
  webhooks map to an env-configured workspace because they carry no session.

## Known limitations

- The classifier is advisory, not an emergency-response service. If someone is
  in immediate danger, contact local authorities.
- YouTube's Data API has no moderation endpoints; CreaGuard cannot act on
  YouTube content programmatically and never pretends otherwise.
