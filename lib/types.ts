export type RiskCategory =
  | "threat"
  | "doxxing"
  | "impersonation"
  | "scam"
  | "harassment"
  | "criticism"
  | "other";

export type IncidentStatus =
  | "needs_review"
  | "monitoring"
  | "quarantined"
  | "resolved"
  | "dismissed";

export type Severity = 1 | 2 | 3 | 4 | 5;

export interface Classification {
  category: RiskCategory;
  severity: Severity;
  confidence: number;
  summary: string;
  requiresHumanReview: boolean;
  recommendedAction: string;
  source: "featherless" | "not_configured";
}

export interface IncidentEvent {
  id: string;
  message: string;
  authorId?: string;
  platform?: string;
  createdAt: string;
  classification?: Classification;
}

export interface Incident {
  id: string;
  externalId: string;
  events: IncidentEvent[];
  status: IncidentStatus;
  severity: Severity;
  riskScore: number;
  category: RiskCategory;
  createdAt: string;
  updatedAt: string;
  followUpAt?: string;
  decisionNote?: string;
  mindsAlias?: string;
  /** Cached Mind reply so the dashboard loads it instantly on revisit. */
  mindsReply?: string;
  /** Where the Telegram bot posted its verdict, so decisions can post back. */
  telegramChatId?: number;
  telegramMessageId?: number;
  /** Offender identity + source pointers captured at intake, for human-confirmed enforcement. */
  externalAuthorId?: string;
  sourceGuildId?: string;
  sourceChannelId?: string;
  sourceMessageId?: string;
  /** Cross-platform offender profile this case belongs to (entity memory). */
  suspectId?: string;
  /** The Mind's autonomous recommendation for this open case, surfaced as a one-click action. */
  proposedAction?: string;
  proposedActionAt?: string;
}

export interface Policy {
  content: string;
  updatedAt: string;
}

/**
 * Cross-platform offender profile: one identity, many handles/platforms.
 * Built by linking incidents whose normalized author handle matches, so
 * the Mind's memory is about *people*, not just cases.
 */
export interface Suspect {
  id: string;
  handle: string;
  aliases: { handle: string; platform: string }[];
  incidentIds: string[];
  platforms: string[];
  firstSeen: string;
  lastSeen: string;
}

/** A policy change the Mind proposed; the creator approves or rejects it. */
export interface PolicyProposal {
  id: string;
  content: string;
  summary: string;
  createdAt: string;
  status: "pending" | "accepted" | "rejected";
  /** Minds conversation alias for the pending proposal request (async reply). */
  mindAlias?: string;
}

/**
 * Which channels a creator has connected to this workspace (max 3:
 * telegram, youtube, discord). The dashboard shows only incidents from
 * connected channels, so a creator who only sets up Telegram sees only
 * Telegram — easy setup, no noise.
 */
export type ChannelName = "telegram" | "discord" | "youtube";

export interface Connections {
  platforms: ChannelName[];
  /** True once the creator has finished (or skipped) the connect wizard. */
  onboardingDone: boolean;
  /** When the wizard was opened, so channels only count if a case arrives after. */
  wizardStartedAt?: string;
}

export interface SystemStatus {
  storage: "redis" | "file" | "memory";
  featherless: boolean;
  minds: boolean;
  channels: {
    telegram: boolean;
    youtube: boolean;
    discord: boolean;
  };
}

/** A YouTube video CreaGuard keeps watching for new comments (auto-watch). */
export interface WatchedVideo {
  videoId: string;
  title: string;
  url: string;
  addedAt: string;
  lastCheckedAt?: string;
  /** Incident ids created from this video, for dedupe-safe re-imports. */
  incidentIds?: string[];
}
