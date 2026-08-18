import type { Incident, Policy } from "./types";

interface CreaGuardMemoryBucket {
  incidents?: Incident[];
  policy?: Policy;
  seen?: Record<string, string[]>;
}

declare global {
  var __CREAGUARD_MEMORY__: Record<string, CreaGuardMemoryBucket> | undefined;
}

export {};
