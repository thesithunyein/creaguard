import type { Classification, RiskCategory, Severity } from "./types";

const FEATHERLESS_URL = "https://api.featherless.ai/v1/chat/completions";

const SYSTEM_PROMPT = `You are the safety-classification module of CreaGuard, a creator-safety system.
Analyze the message in the context of a content creator's community.
Return ONLY strict JSON with this exact shape:
{
  "category": "threat" | "doxxing" | "impersonation" | "scam" | "harassment" | "criticism" | "other",
  "severity": 1 | 2 | 3 | 4 | 5,
  "confidence": 0.0 to 1.0,
  "summary": "one sentence",
  "requiresHumanReview": true | false,
  "recommendedAction": "short safe action for a human reviewer"
}
Rules:
- Ordinary criticism is allowed; do not treat it as harassment.
- threats, doxxing, impersonation, scams, and severe harassment require human review.
- Never recommend an automatic ban or contacting authorities.
- Preserve evidence for high-severity signals.`;

function clampSeverity(value: number): Severity {
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded as Severity;
}

function normalizeCategory(value: string): RiskCategory {
  const allowed: RiskCategory[] = [
    "threat",
    "doxxing",
    "impersonation",
    "scam",
    "harassment",
    "criticism",
    "other",
  ];
  return allowed.includes(value as RiskCategory) ? (value as RiskCategory) : "other";
}

function parseClassification(text: string): Classification | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      category: normalizeCategory(String(parsed.category ?? "other")),
      severity: clampSeverity(Number(parsed.severity ?? 1)),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0))),
      summary: String(parsed.summary ?? "No summary provided.").slice(0, 500),
      requiresHumanReview: Boolean(parsed.requiresHumanReview),
      recommendedAction: String(
        parsed.recommendedAction ?? "Review the case manually.",
      ).slice(0, 500),
      source: "featherless",
    };
  } catch {
    return null;
  }
}

export async function analyzeMessage(
  message: string,
  authorId?: string,
): Promise<Classification> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) {
    return {
      category: "other",
      severity: 1,
      confidence: 0,
      summary: "Analysis is not configured.",
      requiresHumanReview: true,
      recommendedAction:
        "Configure the Featherless API key to enable automated analysis.",
      source: "not_configured",
    };
  }

  const model =
    process.env.FEATHERLESS_MODEL ?? "Qwen/Qwen2.5-7B-Instruct";

  const response = await fetch(FEATHERLESS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Author: ${authorId ?? "unknown"}\nMessage: ${message}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Featherless request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const classification = parseClassification(cleaned);
  if (!classification) {
    throw new Error("Featherless returned invalid classification JSON.");
  }
  return classification;
}
