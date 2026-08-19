import { Redis } from "@upstash/redis";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  Connections,
  Incident,
  Policy,
  PolicyProposal,
  Suspect,
  SystemStatus,
} from "./types";

type StorageMode = "redis" | "file" | "memory";

function redisCredentials() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function storageMode(): StorageMode {
  if (redisCredentials()) return "redis";
  return process.env.VERCEL ? "memory" : "file";
}

function redisClient(): Redis | null {
  const credentials = redisCredentials();
  if (!credentials) return null;
  return new Redis({ url: credentials.url, token: credentials.token });
}

function dataDir(): string {
  return join(process.cwd(), ".data");
}

function safeId(workspaceId: string): string {
  return workspaceId.replace(/[^a-zA-Z0-9._-]/g, "-") || "demo";
}

// Keys used before workspaces were introduced. The demo workspace reads
// these as a fallback so pre-auth data stays visible.
const LEGACY_KEYS = {
  incidents: "creaguard:incidents",
  policy: "creaguard:policy",
  seen: "creaguard:seen",
} as const;

function incidentsKey(workspaceId: string): string {
  return `creaguard:incidents:${workspaceId}`;
}
function policyKey(workspaceId: string): string {
  return `creaguard:policy:${workspaceId}`;
}
function seenKey(workspaceId: string): string {
  return `creaguard:seen:${workspaceId}`;
}
function suspectsKey(workspaceId: string): string {
  return `creaguard:suspects:${workspaceId}`;
}
function proposalsKey(workspaceId: string): string {
  return `creaguard:proposals:${workspaceId}`;
}
function connectionsKey(workspaceId: string): string {
  return `creaguard:connections:${workspaceId}`;
}
function incidentsFile(workspaceId: string): string {
  return `incidents-${safeId(workspaceId)}.json`;
}
function policyFile(workspaceId: string): string {
  return `policy-${safeId(workspaceId)}.json`;
}
function seenFile(workspaceId: string): string {
  return `seen-${safeId(workspaceId)}.json`;
}
function suspectsFile(workspaceId: string): string {
  return `suspects-${safeId(workspaceId)}.json`;
}
function proposalsFile(workspaceId: string): string {
  return `proposals-${safeId(workspaceId)}.json`;
}
function connectionsFile(workspaceId: string): string {
  return `connections-${safeId(workspaceId)}.json`;
}

interface MemoryBucket {
  incidents?: Incident[];
  policy?: Policy;
  seen?: Record<string, string[]>;
  suspects?: Suspect[];
  proposals?: PolicyProposal[];
  connections?: Connections;
}

function memoryBucket(workspaceId: string): MemoryBucket {
  const all =
    globalThis.__CREAGUARD_MEMORY__ ?? (globalThis.__CREAGUARD_MEMORY__ = {});
  return all[workspaceId] ?? (all[workspaceId] = {});
}

function readFileJson<T>(name: string, fallback: T): T {
  try {
    const path = join(dataDir(), name);
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeFileJson(name: string, value: unknown): void {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(value, null, 2), "utf-8");
}

async function readIncidents(workspaceId: string): Promise<Incident[]> {
  const mode = storageMode();
  if (mode === "redis") {
    const client = redisClient();
    const fresh = await client?.get<Incident[]>(incidentsKey(workspaceId));
    if (fresh != null) return fresh;
    if (workspaceId === "demo") {
      return (await client?.get<Incident[]>(LEGACY_KEYS.incidents)) ?? [];
    }
    return [];
  }
  if (mode === "file") {
    const fresh = readFileJson<Incident[] | null>(
      incidentsFile(workspaceId),
      null,
    );
    if (fresh != null) return fresh;
    if (workspaceId === "demo") {
      return readFileJson<Incident[]>("incidents.json", []);
    }
    return [];
  }
  return memoryBucket(workspaceId).incidents ?? [];
}

async function writeIncidents(
  workspaceId: string,
  incidents: Incident[],
): Promise<void> {
  const mode = storageMode();
  if (mode === "redis") {
    await redisClient()?.set(incidentsKey(workspaceId), incidents);
    return;
  }
  if (mode === "file") {
    writeFileJson(incidentsFile(workspaceId), incidents);
    return;
  }
  memoryBucket(workspaceId).incidents = incidents;
}

async function readPolicy(workspaceId: string): Promise<Policy> {
  const mode = storageMode();
  if (mode === "redis") {
    const client = redisClient();
    const fresh = await client?.get<Policy>(policyKey(workspaceId));
    if (fresh != null) return fresh;
    if (workspaceId === "demo") {
      return (
        (await client?.get<Policy>(LEGACY_KEYS.policy)) ?? defaultPolicy()
      );
    }
    return defaultPolicy();
  }
  if (mode === "file") {
    const fresh = readFileJson<Policy | null>(policyFile(workspaceId), null);
    if (fresh != null) return fresh;
    if (workspaceId === "demo") {
      return readFileJson<Policy>("policy.json", defaultPolicy());
    }
    return defaultPolicy();
  }
  return memoryBucket(workspaceId).policy ?? defaultPolicy();
}

async function writePolicy(
  workspaceId: string,
  policy: Policy,
): Promise<void> {
  const mode = storageMode();
  if (mode === "redis") {
    await redisClient()?.set(policyKey(workspaceId), policy);
    return;
  }
  if (mode === "file") {
    writeFileJson(policyFile(workspaceId), policy);
    return;
  }
  memoryBucket(workspaceId).policy = policy;
}

async function readSeen(
  workspaceId: string,
): Promise<Record<string, string[]>> {
  const mode = storageMode();
  if (mode === "redis") {
    const client = redisClient();
    const fresh = await client?.get<Record<string, string[]>>(
      seenKey(workspaceId),
    );
    if (fresh != null) return fresh;
    if (workspaceId === "demo") {
      return (
        (await client?.get<Record<string, string[]>>(LEGACY_KEYS.seen)) ?? {}
      );
    }
    return {};
  }
  if (mode === "file") {
    const fresh = readFileJson<Record<string, string[]> | null>(
      seenFile(workspaceId),
      null,
    );
    if (fresh != null) return fresh;
    if (workspaceId === "demo") {
      return readFileJson<Record<string, string[]>>("seen.json", {});
    }
    return {};
  }
  return memoryBucket(workspaceId).seen ?? {};
}

async function writeSeen(
  workspaceId: string,
  seen: Record<string, string[]>,
): Promise<void> {
  const mode = storageMode();
  if (mode === "redis") {
    await redisClient()?.set(seenKey(workspaceId), seen);
    return;
  }
  if (mode === "file") {
    writeFileJson(seenFile(workspaceId), seen);
    return;
  }
  memoryBucket(workspaceId).seen = seen;
}

function defaultPolicy(): Policy {
  return {
    content:
      "Do not punish ordinary criticism. Escalate threats, doxxing, impersonation, scams, and repeated targeted harassment for human review. Never ban or report automatically.",
    updatedAt: new Date().toISOString(),
  };
}

export async function getIncidents(workspaceId: string): Promise<Incident[]> {
  const incidents = await readIncidents(workspaceId);
  return incidents.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getIncident(
  workspaceId: string,
  id: string,
): Promise<Incident | null> {
  const incidents = await readIncidents(workspaceId);
  return incidents.find((item) => item.id === id || item.externalId === id) ?? null;
}

export async function saveIncident(
  workspaceId: string,
  incident: Incident,
): Promise<Incident> {
  const incidents = await readIncidents(workspaceId);
  const index = incidents.findIndex((item) => item.id === incident.id);
  if (index >= 0) incidents[index] = incident;
  else incidents.unshift(incident);
  await writeIncidents(workspaceId, incidents);
  return incident;
}

export async function getPolicy(workspaceId: string): Promise<Policy> {
  return readPolicy(workspaceId);
}

export async function savePolicy(
  workspaceId: string,
  content: string,
): Promise<Policy> {
  const policy: Policy = { content, updatedAt: new Date().toISOString() };
  await writePolicy(workspaceId, policy);
  return policy;
}

/**
 * Returns only the ids that have not been processed yet for a platform
 * (e.g. YouTube comments) and records them so repeated imports never
 * create duplicate incidents.
 */
export async function dedupeSeen(
  workspaceId: string,
  platform: string,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const seen = await readSeen(workspaceId);
  const existing = new Set(seen[platform] ?? []);
  const fresh = ids.filter((id) => !existing.has(id));
  if (fresh.length > 0) {
    seen[platform] = [...(seen[platform] ?? []), ...fresh].slice(-1000);
    await writeSeen(workspaceId, seen);
  }
  return fresh;
}

async function readSuspects(workspaceId: string): Promise<Suspect[]> {
  const mode = storageMode();
  if (mode === "redis") {
    return (
      (await redisClient()?.get<Suspect[]>(suspectsKey(workspaceId))) ?? []
    );
  }
  if (mode === "file") {
    return readFileJson<Suspect[] | null>(suspectsFile(workspaceId), null) ?? [];
  }
  return memoryBucket(workspaceId).suspects ?? [];
}

async function writeSuspects(
  workspaceId: string,
  suspects: Suspect[],
): Promise<void> {
  const mode = storageMode();
  if (mode === "redis") {
    await redisClient()?.set(suspectsKey(workspaceId), suspects);
    return;
  }
  if (mode === "file") {
    writeFileJson(suspectsFile(workspaceId), suspects);
    return;
  }
  memoryBucket(workspaceId).suspects = suspects;
}

async function readProposals(workspaceId: string): Promise<PolicyProposal[]> {
  const mode = storageMode();
  if (mode === "redis") {
    return (
      (await redisClient()?.get<PolicyProposal[]>(proposalsKey(workspaceId))) ??
      []
    );
  }
  if (mode === "file") {
    return (
      readFileJson<PolicyProposal[] | null>(proposalsFile(workspaceId), null) ??
      []
    );
  }
  return memoryBucket(workspaceId).proposals ?? [];
}

async function writeProposals(
  workspaceId: string,
  proposals: PolicyProposal[],
): Promise<void> {
  const mode = storageMode();
  if (mode === "redis") {
    await redisClient()?.set(proposalsKey(workspaceId), proposals);
    return;
  }
  if (mode === "file") {
    writeFileJson(proposalsFile(workspaceId), proposals);
    return;
  }
  memoryBucket(workspaceId).proposals = proposals;
}

export async function getSuspects(workspaceId: string): Promise<Suspect[]> {
  const suspects = await readSuspects(workspaceId);
  return suspects.sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
  );
}

export async function saveSuspect(
  workspaceId: string,
  suspect: Suspect,
): Promise<Suspect> {
  const suspects = await readSuspects(workspaceId);
  const index = suspects.findIndex((item) => item.id === suspect.id);
  if (index >= 0) suspects[index] = suspect;
  else suspects.push(suspect);
  await writeSuspects(workspaceId, suspects);
  return suspect;
}

export async function getProposals(workspaceId: string): Promise<PolicyProposal[]> {
  const proposals = await readProposals(workspaceId);
  return proposals.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function saveProposal(
  workspaceId: string,
  proposal: PolicyProposal,
): Promise<PolicyProposal> {
  const proposals = await readProposals(workspaceId);
  const index = proposals.findIndex((item) => item.id === proposal.id);
  if (index >= 0) proposals[index] = proposal;
  else proposals.unshift(proposal);
  await writeProposals(workspaceId, proposals);
  return proposal;
}

async function readConnections(workspaceId: string): Promise<Connections> {
  const mode = storageMode();
  if (mode === "redis") {
    return (
      (await redisClient()?.get<Connections>(connectionsKey(workspaceId))) ??
      defaultConnections()
    );
  }
  if (mode === "file") {
    return (
      readFileJson<Connections | null>(connectionsFile(workspaceId), null) ??
      defaultConnections()
    );
  }
  return memoryBucket(workspaceId).connections ?? defaultConnections();
}

async function writeConnections(
  workspaceId: string,
  connections: Connections,
): Promise<void> {
  const mode = storageMode();
  if (mode === "redis") {
    await redisClient()?.set(connectionsKey(workspaceId), connections);
    return;
  }
  if (mode === "file") {
    writeFileJson(connectionsFile(workspaceId), connections);
    return;
  }
  memoryBucket(workspaceId).connections = connections;
}

function defaultConnections(): Connections {
  return { platforms: [], onboardingDone: false };
}

export async function getConnections(workspaceId: string): Promise<Connections> {
  return readConnections(workspaceId);
}

export async function saveConnections(
  workspaceId: string,
  connections: Connections,
): Promise<Connections> {
  await writeConnections(workspaceId, connections);
  return connections;
}

export async function systemStatus(): Promise<SystemStatus> {
  return {
    storage: storageMode(),
    featherless: Boolean(process.env.FEATHERLESS_API_KEY),
    minds: Boolean(process.env.MINDS_BUILDER_API_KEY && process.env.MINDS_MIND_ID),
    channels: {
      telegram: Boolean(
        process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_SECRET,
      ),
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
      discord: Boolean(
        process.env.DISCORD_BOT_TOKEN &&
          process.env.DISCORD_APPLICATION_ID &&
          process.env.DISCORD_PUBLIC_KEY,
      ),
    },
  };
}
