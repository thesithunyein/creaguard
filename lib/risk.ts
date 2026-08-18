import type { Classification, Severity } from "./types";

const HUMAN_REVIEW_CATEGORIES = new Set([
  "threat",
  "doxxing",
  "impersonation",
  "scam",
]);

export function computeRisk(
  classification: Classification,
  eventCount: number,
): { score: number; severity: Severity } {
  const repetitionBonus = Math.min(3, Math.max(0, eventCount - 1));
  const score = Math.min(
    100,
    Math.round(
      (classification.severity * 16 + classification.confidence * 10) *
        10 +
        repetitionBonus * 8,
    ) / 10,
  );
  const severity = classification.severity;
  return { score, severity };
}

export function requiresHumanReview(
  classification: Classification,
): boolean {
  if (classification.requiresHumanReview) return true;
  if (HUMAN_REVIEW_CATEGORIES.has(classification.category)) return true;
  return classification.severity >= 4;
}

/**
 * Auto-handling tier: obvious scams with high confidence are quarantined
 * automatically (hidden from the main queue, still reviewable) so busy
 * creators never see obvious spam. Everything else keeps human review.
 */
export function shouldAutoQuarantine(
  classification: Classification,
): boolean {
  return (
    classification.category === "scam" &&
    classification.confidence >= 0.9 &&
    classification.severity >= 3
  );
}

export function computeFollowUpAt(score: number, now = new Date()): string {
  const minutes = score >= 70 ? 24 * 60 : score >= 40 ? 3 * 24 * 60 : 0;
  if (minutes === 0) return "";
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}
