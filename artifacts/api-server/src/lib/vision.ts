/**
 * vision.ts — STUBBED hazard classifier for Wahatna.
 *
 * Computer-vision inference is intentionally NOT implemented. Instead of
 * analysing image pixels, the hazard class is derived from the category the
 * field worker selects in the mobile app. Confidence is always null to make
 * the stubbed nature explicit.
 */

export interface VisionDict {
  threat_class: string;
  threat_label: string;
  confidence: number | null;
  severity: number; // 1 (low) – 5 (critical)
  severity_label: string;
  recommended_action: string;
  secondary_threats: string[];
  heat_index_estimate: number | null;
  processing_time_ms: number;
}

const SEVERITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Moderate",
  3: "Elevated",
  4: "High",
  5: "Critical",
};

interface CategoryProfile {
  threat_class: string;
  threat_label: string;
  severity: number;
  recommended_action: string;
  secondary_threats: string[];
  heat_index_estimate: number | null;
}

// Maps the mobile app's hazard categories to a deterministic classification.
const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  heat_stress: {
    threat_class: "heat_stress",
    threat_label: "Heat Stress / Hyperthermia",
    severity: 3,
    recommended_action:
      "Move worker to shaded area and provide cold water immediately. Activate MOHRE heat protocol.",
    secondary_threats: ["dehydration_risk", "heat_stroke_risk"],
    heat_index_estimate: 44.0,
  },
  road_damage: {
    threat_class: "road_hazard",
    threat_label: "Road Infrastructure Hazard",
    severity: 2,
    recommended_action:
      "Place safety cones and notify Roads & Transport Authority (RTA).",
    secondary_threats: ["vehicle_collision_risk"],
    heat_index_estimate: null,
  },
  waste: {
    threat_class: "waste_hazard",
    threat_label: "Waste / Sanitation Hazard",
    severity: 2,
    recommended_action:
      "Cordon off area and request municipal waste collection. Use PPE when handling.",
    secondary_threats: ["contamination_risk", "respiratory_risk"],
    heat_index_estimate: null,
  },
  flood: {
    threat_class: "flood_risk",
    threat_label: "Flash Flood / Water Accumulation",
    severity: 3,
    recommended_action:
      "Move vehicles and equipment to higher ground. Do not enter flooded wadi areas. Contact NCM.",
    secondary_threats: ["electrical_hazard", "contamination_risk"],
    heat_index_estimate: null,
  },
  fire: {
    threat_class: "fire_hazard",
    threat_label: "Fire Hazard",
    severity: 4,
    recommended_action:
      "Evacuate immediately and call Civil Defence (997). Do not attempt to fight the fire.",
    secondary_threats: ["smoke_inhalation_risk", "structural_collapse_risk"],
    heat_index_estimate: null,
  },
  electrical: {
    threat_class: "power_line_hazard",
    threat_label: "Electrical / Power Line Hazard",
    severity: 4,
    recommended_action:
      "Maintain 10m clearance. Contact DEWA (991) / ADDC immediately. Do not approach downed lines.",
    secondary_threats: ["electrocution_risk", "fire_ignition_risk"],
    heat_index_estimate: null,
  },
  structural: {
    threat_class: "structural_risk",
    threat_label: "Structural Risk",
    severity: 4,
    recommended_action:
      "Cordon off area 50m radius. Halt all work near structure. Contact Civil Defence.",
    secondary_threats: ["fall_risk", "dust_inhalation_risk"],
    heat_index_estimate: null,
  },
  other: {
    threat_class: "general_hazard",
    threat_label: "General Hazard",
    severity: 2,
    recommended_action:
      "Assess the situation, secure the area, and notify the relevant municipal authority.",
    secondary_threats: ["unspecified_risk"],
    heat_index_estimate: null,
  },
};

/**
 * Classify a report from the worker-selected category. CV inference is stubbed:
 * `confidence` is always null because no image model is run.
 */
export function analyzeCategory(
  category: string | undefined,
  hasImage: boolean,
): VisionDict {
  const key = (category ?? "other").toLowerCase();
  const profile = CATEGORY_PROFILES[key] ?? CATEGORY_PROFILES["other"]!;

  return {
    threat_class: profile.threat_class,
    threat_label: profile.threat_label,
    confidence: null, // STUB: no computer-vision model is run.
    severity: profile.severity,
    severity_label: SEVERITY_LABELS[profile.severity] ?? "Elevated",
    recommended_action: profile.recommended_action,
    secondary_threats: profile.secondary_threats,
    heat_index_estimate: profile.heat_index_estimate,
    processing_time_ms: hasImage ? 0 : 0,
  };
}

export const SEVERITY_TO_LABEL: Record<number, string> = {
  1: "low",
  2: "moderate",
  3: "elevated",
  4: "high",
  5: "critical",
};
