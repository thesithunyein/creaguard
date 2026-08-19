import type {
  ChannelName,
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
  channelPings?: Record<ChannelName, string>;
}

declare global {
  var __CREAGUARD_MEMORY__: Record<string, CreaGuardMemoryBucket> | undefined;
}

export {};
