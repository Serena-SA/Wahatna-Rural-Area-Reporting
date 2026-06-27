/**
 * k2think.ts — K2 Think V2 reasoning over the YOLO output + the user's report.
 *
 * Given the computer-vision detections and the reporter's description, K2 Think:
 *   1. selects the single best hazard category for the user (from the app's set),
 *   2. rates severity 1–5,
 *   3. estimates how long the government will take to resolve it.
 *
 * The API key lives ONLY in artifacts/api-server/.env as K2THINK_API_KEY.
 * If the key is missing or the call fails, callers fall back to the local
 * rule-based assessment (agent.ts) so the app keeps working.
 */

import type { Detection } from "./yolo";

const K2_URL = process.env.K2THINK_URL || "https://api.k2think.ai/v1/chat/completions";
const K2_MODEL = process.env.K2THINK_MODEL || "MBZUAI-IFM/K2-Think-v2";

/** App hazard categories K2 must choose from (must match the mobile app). */
export const APP_CATEGORIES = [
  "fire",
  "flood",
  "road_damage",
  "electrical",
  "heat_stress",
  "waste",
  "structural",
  "other",
] as const;

export interface K2Assessment {
  hazard_category: string;
  severity: number; // 1–5
  severity_label: string;
  eta_hours: number;
  eta_text: string;
  reasoning: string;
  recommended_action: string;
}

export function k2Available(): boolean {
  return !!process.env.K2THINK_API_KEY;
}

const SEVERITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Moderate",
  3: "Elevated",
  4: "High",
  5: "Critical",
};

const SYSTEM_PROMPT =
  "You are the hazard-triage assistant for Wahatna, a rural safety platform for " +
  "Al Qua'a in the United Arab Emirates — a hot, spread-out desert region with " +
  "farms and camel facilities. You receive computer-vision detections from a " +
  "YOLO model plus a field reporter's text, and you decide how the government " +
  "should triage the hazard. Always answer with ONE compact JSON object and " +
  "nothing else.";

function buildUserPrompt(p: {
  detections: Detection[];
  description: string;
  userCategory: string;
}): string {
  const detText = p.detections.length
    ? p.detections
        .map((d) => `${d.label} (${Math.round(d.confidence * 100)}% confidence)`)
        .join(", ")
    : "none — the vision model detected nothing";

  return [
    `Computer-vision detections: ${detText}.`,
    `Reporter's chosen category: ${p.userCategory}.`,
    `Reporter's description: "${p.description || "(none provided)"}".`,
    "",
    `Choose hazard_category as exactly one of: ${APP_CATEGORIES.join(", ")}.`,
    "If the vision model detected something, let it guide the category; otherwise",
    "rely on the reporter's chosen category and description.",
    "Rate severity 1 (low) to 5 (critical). Estimate eta_hours = how many hours",
    "a UAE municipal/government team will realistically take to resolve it, and",
    "eta_text = a short human phrase for that (e.g. 'about 2 days').",
    "",
    "Respond with ONLY this JSON (no markdown, no prose):",
    '{"hazard_category":"...","severity":1-5,"eta_hours":<number>,' +
      '"eta_text":"...","reasoning":"one short sentence",' +
      '"recommended_action":"one short sentence"}',
  ].join("\n");
}

/** Extract the last JSON object from a possibly-reasoning model response. */
function extractJson(content: string): Record<string, unknown> | null {
  // K2-Think emits reasoning (sometimes in <think>..</think>) before the answer.
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Find the last balanced {...} block.
  let depth = 0;
  let start = -1;
  let candidate = "";
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) candidate = cleaned.slice(start, i + 1);
    }
  }
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clampSeverity(v: unknown): number {
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

/**
 * Ask K2 Think to triage the report. Returns null if no key is set; throws on
 * network/HTTP/parse failure so the caller can fall back to the local agent.
 */
export async function assessWithK2(p: {
  detections: Detection[];
  description: string;
  userCategory: string;
}): Promise<K2Assessment | null> {
  const key = process.env.K2THINK_API_KEY;
  if (!key) return null;

  const res = await fetch(K2_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: K2_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(p) },
      ],
      stream: false,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    throw new Error(`K2 Think HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed) throw new Error("K2 Think returned no parseable JSON");

  const rawCat = String(parsed["hazard_category"] ?? "").toLowerCase().trim();
  const hazard_category = (APP_CATEGORIES as readonly string[]).includes(rawCat)
    ? rawCat
    : p.userCategory;
  const severity = clampSeverity(parsed["severity"]);
  const etaHoursRaw = Number(parsed["eta_hours"]);
  const eta_hours = Number.isFinite(etaHoursRaw) && etaHoursRaw > 0 ? etaHoursRaw : 72;

  return {
    hazard_category,
    severity,
    severity_label: SEVERITY_LABELS[severity] ?? "Elevated",
    eta_hours,
    eta_text:
      typeof parsed["eta_text"] === "string" && parsed["eta_text"]
        ? (parsed["eta_text"] as string)
        : `~${Math.round(eta_hours)}h`,
    reasoning: typeof parsed["reasoning"] === "string" ? (parsed["reasoning"] as string) : "",
    recommended_action:
      typeof parsed["recommended_action"] === "string"
        ? (parsed["recommended_action"] as string)
        : "",
  };
}
