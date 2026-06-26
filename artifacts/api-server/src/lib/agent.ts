/**
 * agent.ts — Local rule-based incident assessment for Wahatna.
 *
 * The original design called out to the external K2Think API. This is a fully
 * local reimplementation: BM25 retrieval over an in-process UAE municipal
 * knowledge base, plus deterministic rule-based assessment (no external key).
 */

import type { VisionDict } from "./vision";

interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

export const KNOWLEDGE_BASE: KnowledgeDoc[] = [
  {
    id: "mohre_heat_ban",
    title: "MOHRE Outdoor Work Heat Ban",
    content:
      "The UAE Ministry of Human Resources and Emiratisation (MOHRE) prohibits outdoor work between 12:30 PM and 3:00 PM from 15 June to 15 September each year. Violation by an employer results in a fine of AED 5,000 per worker. Workers must be provided shade, cool water, and rest areas. Heat stress first aid kits must be available at all outdoor construction sites.",
    tags: ["heat", "mohre", "outdoor", "ban", "summer", "worker", "compliance"],
  },
  {
    id: "civil_defence_fire",
    title: "UAE Civil Defence Fire Safety Protocol",
    content:
      "All fire incidents must be reported to UAE Civil Defence on 997 immediately. Site managers must ensure fire extinguishers are inspected monthly. Dubai Civil Defence (DCD) requires a fire safety plan for all sites with more than 10 workers. Evacuation routes must be marked and tested quarterly. Flammable materials must be stored 15m from open flames and 5m from structures.",
    tags: ["fire", "civil defence", "evacuation", "extinguisher", "protocol", "safety"],
  },
  {
    id: "structural_inspection",
    title: "UAE Structural Safety — Site Inspection Requirements",
    content:
      "Under UAE Federal Law No. 6 of 2012, all construction sites must have a licensed structural engineer on call. Buildings showing signs of distress (cracks > 3mm, visible rebar corrosion, settlement > 25mm) must be immediately evacuated and reported to the relevant municipality. In Dubai, contact Dubai Municipality's Building Inspection Section at +971 4 221 5555. In Abu Dhabi, contact the Department of Municipalities and Transport.",
    tags: ["structural", "building", "inspection", "crack", "settlement", "engineer"],
  },
  {
    id: "wadi_flood_protocol",
    title: "UAE Flash Flood / Wadi Flood Response",
    content:
      "Flash floods (سيول, suyool) are common in UAE wadis during rainfall events. The National Centre of Meteorology (NCM) issues flood advisories via SMS and their app. Workers must evacuate wadi areas immediately upon advisory. Roads in wadi zones should be cordoned using RTA barriers. Abu Dhabi Civil Defence coordinates flood rescue on 999. Do not drive through flooded areas — 30cm of water can move a vehicle.",
    tags: ["flood", "wadi", "suyool", "ncm", "rain", "flash", "water"],
  },
  {
    id: "hazmat_protocol",
    title: "UAE HAZMAT / Chemical Spill Response",
    content:
      "Chemical spills must be reported to UAE Civil Defence HAZMAT team on 997. The Environment Agency Abu Dhabi (EAD) and Dubai Municipality Environment Department must be notified within 1 hour of a spill exceeding 10 litres. Federal Law No. 24 of 1999 on Protection and Development of the Environment mandates immediate containment. Workers must use appropriate PPE (chemical resistant gloves, goggles, respirator). MSDS/SDS for all chemicals on site must be accessible.",
    tags: ["chemical", "hazmat", "spill", "ead", "environment", "ppe", "toxic"],
  },
  {
    id: "dewa_electrical",
    title: "DEWA / ADDC Electrical Hazard Protocol",
    content:
      "Dubai Electricity and Water Authority (DEWA) emergency line: 991. Abu Dhabi Distribution Company (ADDC): 800-2332. Maintain a minimum 10m horizontal and 4m vertical clearance from overhead power lines during construction. No work shall commence within the exclusion zone without written DEWA/ADDC approval. Downed power lines must be reported immediately. Workers must not touch any downed line — rubber-soled boots and insulated gloves are mandatory in HV zones.",
    tags: ["electrical", "dewa", "addc", "power", "line", "voltage", "electrocution"],
  },
  {
    id: "rta_road_hazard",
    title: "RTA Road Hazard Reporting",
    content:
      "Road defects and hazards in Dubai must be reported to the Roads and Transport Authority (RTA) at 800-90-90. Abu Dhabi road hazards go to the Department of Municipalities and Transport on 800-555. Emergency lane closures require reflective cones every 10m and a warning truck with flashing signs. Temporary Traffic Management Plans (TTMP) must be approved by RTA before any lane closure exceeding 4 hours.",
    tags: ["road", "rta", "lane", "closure", "traffic", "pothole", "infrastructure"],
  },
  {
    id: "dust_storm_protocol",
    title: "UAE Haboob / Dust Storm Safety Protocol",
    content:
      "Dust storms (عواصف رملية, awaasif ramliyya) are classified by NCM as Yellow (visibility 500–1000m), Orange (200–500m), and Red (< 200m) alerts. During Orange/Red alerts: all outdoor work must cease, scaffolding must be secured, crane operations suspended. Workers with respiratory conditions must be moved indoors immediately. N95 masks are mandatory during dust events. NCM issues advisories via the UAE Alert app.",
    tags: ["dust", "storm", "haboob", "sandstorm", "ncm", "visibility", "respiratory"],
  },
  {
    id: "emirati_dialect_hazards",
    title: "Emirati Dialect — Hazard & Safety Terminology",
    content:
      "Common Emirati/Gulf Arabic hazard terms and phonetic equivalents: '7arara' or 'harara' (حرارة) = heat; 'nar' (نار) = fire; 'khatar' (خطر) = danger/hazard; 'farigh' (فارغ) = empty/clear; 'yalla imshi' = evacuate/move quickly; 'mafi mushkila' = no problem (often used to downplay hazards — do not accept without investigation); 'ga3da' or 'gaa3' = sitting/stationary worker (may indicate heat exhaustion); 'ta3ban' (تعبان) = tired/unwell — often used to report heat stress in UAE; 'shaghala' = equipment/machinery; 'maafi maay' = no water (critical in heat); 'sukkar' in heat context = blood sugar issues from dehydration.",
    tags: ["arabic", "emirati", "dialect", "gulf", "phonetic", "translation", "local"],
  },
  {
    id: "heat_stress_thresholds",
    title: "UAE Heat Stress — Medical Thresholds & First Aid",
    content:
      "WBGT (Wet Bulb Globe Temperature) thresholds for UAE outdoor work: < 28°C: Normal work. 28–30°C: Caution, increase rest breaks. 30–32°C: Mandatory 15 min rest per 45 min work. 32–35°C: Light work only, 30 min rest per 30 min. > 35°C: Suspend outdoor work. Heat stroke symptoms: core temp > 40°C, confusion, no sweating. First aid: cool immediately in ice bath or wet towels, call 998 (ambulance). Hyponatremia risk: workers drinking excessive plain water without electrolytes. Preferred rehydration: 500ml electrolyte drink per hour in heat.",
    tags: ["heat", "wbgt", "threshold", "first aid", "stroke", "temperature", "medical"],
  },
  {
    id: "waste_sanitation",
    title: "UAE Municipal Waste & Sanitation Standards",
    content:
      "Improper waste disposal must be reported to the local municipality (Dubai Municipality 800-900, Abu Dhabi 800-555). Hazardous and medical waste require licensed Tadweer / Bee'ah collection. Open dumping is prohibited under Federal Law No. 12 of 2018 on Integrated Waste Management. Standing waste in heat accelerates bacterial growth and pest infestation — clear within 24 hours. Workers handling waste must use gloves and masks.",
    tags: ["waste", "sanitation", "municipality", "tadweer", "bee'ah", "disposal", "hygiene"],
  },
];

const RISK_MAP: Record<number, string> = {
  1: "Low",
  2: "Moderate",
  3: "Elevated",
  4: "High",
  5: "Critical",
};

const REGULATORY_BY_CLASS: Record<string, string> = {
  heat_stress: "MOHRE Federal Decree-Law No. 33 of 2021 (Heat Ban)",
  fire_hazard: "UAE Civil Defence Fire & Life Safety Code",
  structural_risk: "UAE Federal Law No. 6 of 2012 (Structural Safety)",
  flood_risk: "NCM Flood Advisory / Abu Dhabi Civil Defence Protocol",
  road_hazard: "RTA Road Safety & Traffic Management Standards",
  power_line_hazard: "DEWA/ADDC HV Clearance Regulations",
  waste_hazard: "UAE Federal Law No. 12 of 2018 (Integrated Waste Management)",
  general_hazard: "MOHRE Federal Decree-Law No. 33 of 2021",
};

// ─── BM25 retrieval ──────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/\b[a-z0-9]+\b/g);
  return matches ?? [];
}

function idf(term: string, docs: string[][]): number {
  const df = docs.filter((doc) => doc.includes(term)).length;
  return Math.log((docs.length - df + 0.5) / (df + 0.5) + 1);
}

export function retrieveContext(query: string, topK = 3): KnowledgeDoc[] {
  const k1 = 1.5;
  const b = 0.75;
  const queryTerms = tokenize(query);
  const tokenizedDocs = KNOWLEDGE_BASE.map((d) =>
    tokenize(d.content + " " + d.tags.join(" ")),
  );
  const avgDl =
    tokenizedDocs.reduce((sum, d) => sum + d.length, 0) / tokenizedDocs.length;

  const scores: Array<[number, number]> = tokenizedDocs.map(
    (docTokens, i): [number, number] => {
      const dl = docTokens.length;
      const termFreq: Record<string, number> = {};
      for (const t of docTokens) termFreq[t] = (termFreq[t] ?? 0) + 1;
      let score = 0.0;
      for (const term of queryTerms) {
        const tf = termFreq[term] ?? 0;
        const idfVal = idf(term, tokenizedDocs);
        score += (idfVal * (tf * (k1 + 1))) / (tf + k1 * (1 - b + (b * dl) / avgDl));
      }
      return [score, i];
    },
  );

  scores.sort((a, b2) => b2[0] - a[0]);
  if (scores.length === 0 || scores[0]![0] <= 0) return [];
  return scores
    .slice(0, topK)
    .filter(([s]) => s > 0)
    .map(([, i]) => KNOWLEDGE_BASE[i]!);
}

// ─── Dialect interpretation ──────────────────────────────────────────────────

const DIALECT_TERMS: Array<[RegExp, string]> = [
  [/\b(7arara|harara)\b|حرارة/i, "'harara' (حرارة) = heat"],
  [/\bnar\b|نار/i, "'nar' (نار) = fire"],
  [/\bkhatar\b|خطر/i, "'khatar' (خطر) = danger/hazard"],
  [/\bta3ban\b|تعبان/i, "'ta3ban' (تعبان) = tired/unwell, often heat stress"],
  [/\bmaafi maay\b|mafi maay/i, "'maafi maay' = no water (critical in heat)"],
  [/\bmafi mushkila\b/i, "'mafi mushkila' = 'no problem' — may downplay a real hazard"],
  [/\byalla imshi\b/i, "'yalla imshi' = evacuate/move quickly"],
  [/\bsuyool\b|سيول/i, "'suyool' (سيول) = flash floods"],
];

function detectDialect(reportText: string): string | null {
  const notes: string[] = [];
  for (const [re, note] of DIALECT_TERMS) {
    if (re.test(reportText)) notes.push(note);
  }
  if (notes.length === 0) return null;
  return `Detected Emirati/Arabic terms: ${notes.join("; ")}.`;
}

// ─── Assessment ──────────────────────────────────────────────────────────────

export interface AgentAssessment {
  risk_level: string;
  risk_score: number;
  assessment_summary: string;
  recommended_protocol: string;
  regulatory_reference: string;
  dialect_note: string | null;
  context_sources: string[];
  elapsed_ms: number;
}

export function assessIncident(
  vision: VisionDict,
  lat: number,
  lon: number,
  reportText = "",
): AgentAssessment {
  const tStart = Date.now();

  const query = `${vision.threat_class} ${vision.threat_label} ${reportText}`;
  const contextDocs = retrieveContext(query, 3);

  const sev = vision.severity ?? 3;
  const threatLabel = vision.threat_label || vision.threat_class;

  const assessmentSummary =
    `A ${threatLabel.toLowerCase()} was reported at coordinates ` +
    `(${lat.toFixed(4)}, ${lon.toFixed(4)}) in the Al Qua'a / UAE region. ` +
    `Severity is assessed as ${RISK_MAP[sev] ?? "Elevated"}. ` +
    `Immediate response is recommended per UAE municipal and MOHRE safety protocols.`;

  const dialectNote = detectDialect(reportText);

  return {
    risk_level: RISK_MAP[sev] ?? "Elevated",
    risk_score: sev,
    assessment_summary: assessmentSummary,
    recommended_protocol:
      vision.recommended_action ||
      "Follow standard site safety protocol and contact the relevant authority.",
    regulatory_reference:
      REGULATORY_BY_CLASS[vision.threat_class] ??
      "MOHRE Federal Decree-Law No. 33 of 2021",
    dialect_note: dialectNote,
    context_sources: contextDocs.map((d) => d.id),
    elapsed_ms: Date.now() - tStart,
  };
}
