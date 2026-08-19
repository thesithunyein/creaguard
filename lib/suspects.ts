import { newId } from "./ids";
import { getIncidents, getSuspects, saveSuspect } from "./store";
import type { Incident, Suspect } from "./types";

/**
 * Normalizes an author handle so the same person is recognized across
 * platforms: strips @, platform prefixes, and case. "AngryFan" on Discord
 * and "@angryfan" on YouTube resolve to the same identity.
 */
export function normalizeHandle(handle: string): string {
  const cleaned = handle
    .trim()
    .replace(/^@/, "")
    .replace(/^(discord|telegram|youtube|tg|yt|dc)[:_\-/ ]/i, "")
    .toLowerCase();
  return cleaned || "";
}

export function suspectDisplayName(suspect: Suspect | null | undefined): string {
  return suspect?.handle || "Unknown author";
}

/**
 * Finds or creates the cross-platform offender profile for an author.
 * Matching is exact on the normalized handle — honest, no fabricated
 * identity linking. Returns the suspect with this incident linked.
 */
export async function resolveSuspect(
  workspaceId: string,
  authorId: string,
  platform: string,
  incident: Incident,
): Promise<Suspect | null> {
  const normalized = normalizeHandle(authorId);
  if (!normalized) return null;

  const suspects = await getSuspects(workspaceId);
  const existing = suspects.find((suspect) =>
    suspect.aliases.some(
      (alias) => normalizeHandle(alias.handle) === normalized,
    ),
  );

  const now = new Date().toISOString();
  let suspect: Suspect;
  if (existing) {
    suspect = existing;
    if (!suspect.aliases.some((alias) => alias.handle === authorId)) {
      suspect.aliases.push({ handle: authorId, platform });
    }
    if (!suspect.platforms.includes(platform)) {
      suspect.platforms.push(platform);
    }
    if (!suspect.incidentIds.includes(incident.id)) {
      suspect.incidentIds.push(incident.id);
    }
    suspect.lastSeen = now;
  } else {
    suspect = {
      id: newId("sus"),
      handle: authorId,
      aliases: [{ handle: authorId, platform }],
      incidentIds: [incident.id],
      platforms: [platform],
      firstSeen: now,
      lastSeen: now,
    };
  }

  await saveSuspect(workspaceId, suspect);
  return suspect;
}

/**
 * Number of incidents this author already has across all platforms —
 * used as the repetition signal at intake so repeat offenders (even on a
 * different platform) score higher.
 */
export async function suspectIncidentCount(
  workspaceId: string,
  authorId: string,
): Promise<number> {
  const normalized = normalizeHandle(authorId);
  if (!normalized) return 0;
  const suspects = await getSuspects(workspaceId);
  const match = suspects.find((suspect) =>
    suspect.aliases.some(
      (alias) => normalizeHandle(alias.handle) === normalized,
    ),
  );
  return match ? match.incidentIds.length : 0;
}

/** Convenience for the dashboard: load the suspect for a given incident. */
export async function suspectForIncident(
  workspaceId: string,
  incident: Incident,
): Promise<Suspect | null> {
  if (incident.suspectId) {
    const suspects = await getSuspects(workspaceId);
    return suspects.find((suspect) => suspect.id === incident.suspectId) ?? null;
  }
  const authorId = incident.events.at(-1)?.authorId;
  if (!authorId) return null;
  const suspects = await getSuspects(workspaceId);
  const normalized = normalizeHandle(authorId);
  if (!normalized) return null;
  return (
    suspects.find((suspect) =>
      suspect.aliases.some(
        (alias) => normalizeHandle(alias.handle) === normalized,
      ),
    ) ?? null
  );
}

/** All incidents belonging to a suspect (for the drawer's history list). */
export async function incidentsForSuspect(
  workspaceId: string,
  suspectId: string,
): Promise<Incident[]> {
  const all = await getIncidents(workspaceId);
  return all.filter((incident) => incident.suspectId === suspectId);
}