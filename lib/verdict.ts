import type { IncidentStatus, RiskCategory } from "./types";

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  threat: "🚨 Threat",
  doxxing: "⚠️ Doxxing",
  impersonation: "👤 Impersonation",
  scam: "💰 Scam",
  harassment: "🔁 Harassment",
  criticism: "💬 Criticism",
  other: "❔ Unclassified",
};

/** Human verdict text for a case, shared by every channel reply. */
export function verdictFor(status: IncidentStatus): string {
  switch (status) {
    case "needs_review":
      return "Escalated for human review. Your Mind is reviewing this case now — open the dashboard to see its recommendation and approve.";
    case "quarantined":
      return "Auto-quarantined — an obvious scam with high confidence, so it was hidden from the main queue automatically. You can still review or restore it in the dashboard.";
    case "monitoring":
      return "Monitoring — low risk, no action needed.";
    default:
      return `Status: ${status.replace("_", " ")}.`;
  }
}
