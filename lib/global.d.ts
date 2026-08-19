import type { Incident, Policy, PolicyProposal, Suspect } from "./types";

interface CreaGuardMemoryBucket {
  incidents?: Incident[];
  policy?: Policy;
  seen?: Record<string, string[]>;
  suspects?: Suspect[];
  proposals?: PolicyProposal[];
}

declare global {
  var __CREAGUARD_MEMORY__: Record<string, CreaGuardMemoryBucket> | undefined;
}

export {};
