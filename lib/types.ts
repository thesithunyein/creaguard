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
}

export interface Policy {
  content: string;
  updatedAt: string;
}

export interface SystemStatus {
  storage: "redis" | "file" | "memory";
  featherless: boolean;
  minds: boolean;
  channels: {
    telegram: boolean;
    youtube: boolean;
  };
}
