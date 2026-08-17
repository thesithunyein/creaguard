import { Redis } from "@upstash/redis";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Incident, Policy, SystemStatus } from "./types";

type StorageMode = "redis" | "file" | "memory";

const KV_KEYS = {
  incidents: "creaguard:incidents",
  policy: "creaguard:policy",
} as const;

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

async function readIncidents(): Promise<Incident[]> {
  const mode = storageMode();
  if (mode === "redis") {
    return (await redisClient()?.get<Incident[]>(KV_KEYS.incidents)) ?? [];
  }
  if (mode === "file") return readFileJson<Incident[]>("incidents.json", []);
  return globalThis.__CREAGUARD_INCIDENTS__ ?? [];
}

async function writeIncidents(incidents: Incident[]): Promise<void> {
  const mode = storageMode();
  if (mode === "redis") {
    await redisClient()?.set(KV_KEYS.incidents, incidents);
    return;
  }
  if (mode === "file") {
    writeFileJson("incidents.json", incidents);
    return;
  }
  globalThis.__CREAGUARD_INCIDENTS__ = incidents;
}

async function readPolicy(): Promise<Policy> {
  const mode = storageMode();
  if (mode === "redis") {
    return (await redisClient()?.get<Policy>(KV_KEYS.policy)) ?? defaultPolicy();
  }
  if (mode === "file") return readFileJson<Policy>("policy.json", defaultPolicy());
  return globalThis.__CREAGUARD_POLICY__ ?? defaultPolicy();
}

async function writePolicy(policy: Policy): Promise<void> {
  const mode = storageMode();
  if (mode === "redis") {
    await redisClient()?.set(KV_KEYS.policy, policy);
    return;
  }
  if (mode === "file") {
    writeFileJson("policy.json", policy);
    return;
  }
  globalThis.__CREAGUARD_POLICY__ = policy;
}

function defaultPolicy(): Policy {
  return {
    content:
      "Do not punish ordinary criticism. Escalate threats, doxxing, impersonation, scams, and repeated targeted harassment for human review. Never ban or report automatically.",
    updatedAt: new Date().toISOString(),
  };
}

export async function getIncidents(): Promise<Incident[]> {
  const incidents = await readIncidents();
  return incidents.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getIncident(id: string): Promise<Incident | null> {
  const incidents = await readIncidents();
  return incidents.find((item) => item.id === id || item.externalId === id) ?? null;
}

export async function saveIncident(incident: Incident): Promise<Incident> {
  const incidents = await readIncidents();
  const index = incidents.findIndex((item) => item.id === incident.id);
  if (index >= 0) incidents[index] = incident;
  else incidents.unshift(incident);
  await writeIncidents(incidents);
  return incident;
}

export async function getPolicy(): Promise<Policy> {
  return readPolicy();
}

export async function savePolicy(content: string): Promise<Policy> {
  const policy: Policy = { content, updatedAt: new Date().toISOString() };
  await writePolicy(policy);
  return policy;
}

export async function systemStatus(): Promise<SystemStatus> {
  return {
    storage: storageMode(),
    featherless: Boolean(process.env.FEATHERLESS_API_KEY),
    minds: Boolean(process.env.MINDS_BUILDER_API_KEY && process.env.MINDS_MIND_ID),
  };
}
