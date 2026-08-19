import type {
  Connections,
  Incident,
  Policy,
  PolicyProposal,
  Suspect,
} from "./types";

interface CreaGuardMemoryBucket {
  incidents?: Incident[];
  policy?: Policy;
  seen?: Record<string, string[]>;
  suspects?: Suspect[];
  proposals?: PolicyProposal[];
  connections?: Connections;
}

declare global {
  var __CREAGUARD_MEMORY__: Record<string, CreaGuardMemoryBucket> | undefined;
}

export {};
