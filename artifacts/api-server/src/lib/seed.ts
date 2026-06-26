/**
 * seed.ts — Seed realistic UAE-region demo data for Wahatna.
 */

import { sql } from "drizzle-orm";
import {
  db,
  usersTable,
  incidentsTable,
  type InsertUser,
} from "@workspace/db";
import { hashPassword } from "./auth";

const UAE_LOCATIONS: Array<[number, number, string]> = [
  [25.2048, 55.2708, "Downtown Dubai"],
  [25.1972, 55.2744, "Business Bay"],
  [25.0657, 55.1713, "Dubai Marina"],
  [25.2285, 55.3273, "Deira, Dubai"],
  [25.3548, 55.3952, "Dubai Silicon Oasis"],
  [24.4539, 54.3773, "Abu Dhabi Corniche"],
  [24.4686, 54.6071, "Musaffah Industrial"],
  [24.35, 54.5, "Khalifa City"],
  [25.3463, 55.4209, "Sharjah Industrial Area"],
  [25.3988, 55.4711, "Sharjah City Centre"],
  [24.2075, 55.7447, "Al Ain City"],
  [24.1302, 55.8023, "Al Ain Oasis"],
  [25.4052, 55.5136, "Ajman Free Zone"],
  [25.7953, 55.9797, "Ras Al Khaimah"],
  [25.5877, 55.5532, "Umm Al Quwain"],
  [25.1124, 56.3415, "Fujairah Wadi"],
  [24.9857, 55.1713, "Jebel Ali Port"],
  [25.2297, 55.6533, "Al Quoz Industrial"],
];

const THREAT_CLASSES: Array<[string, string, number, string]> = [
  ["fire_hazard", "Fire Hazard", 4, "high"],
  ["heat_stress", "Heat Stress", 3, "elevated"],
  ["structural_risk", "Structural Risk", 4, "high"],
  ["flood_risk", "Flash Flood Risk", 3, "elevated"],
  ["road_hazard", "Road Infrastructure", 2, "moderate"],
  ["chemical_spill", "Chemical Spill", 5, "critical"],
  ["power_line_hazard", "Electrical Hazard", 4, "high"],
  ["dust_storm", "Dust Storm", 2, "moderate"],
];

const STATUSES = [
  "active",
  "active",
  "active",
  "investigating",
  "investigating",
  "resolved",
];

const RISK_LEVELS: Record<number, string> = {
  1: "Low",
  2: "Moderate",
  3: "Elevated",
  4: "High",
  5: "Critical",
};

const SECONDARY_POOL = [
  "smoke_inhalation_risk",
  "dehydration_risk",
  "fall_risk",
  "electrical_hazard",
  "respiratory_risk",
];

// Deterministic seeded PRNG (mulberry32) so seed data is reproducible.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function rngChoice<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function rngUniform(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function rngSample<T>(rng: () => number, arr: T[], k: number): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, k);
}

const DEMO_USERS: Array<Omit<InsertUser, "passwordHash">> = [
  {
    username: "ahmed.al.rashidi",
    email: "ahmed@wahatna.ae",
    fullName: "Ahmed Al Rashidi",
    role: "field_worker",
    employeeId: "FW-0012",
    hazardScore: 1240,
    streakDays: 7,
    totalReports: 23,
  },
  {
    username: "fatima.khalid",
    email: "fatima@wahatna.ae",
    fullName: "Fatima Khalid Al Mansoori",
    role: "supervisor",
    employeeId: "SV-0003",
    hazardScore: 3850,
    streakDays: 14,
    totalReports: 78,
  },
  {
    username: "demo",
    email: "demo@wahatna.ae",
    fullName: "Demo Field Worker",
    role: "field_worker",
    employeeId: "FW-0099",
    hazardScore: 520,
    streakDays: 3,
    totalReports: 11,
  },
  {
    username: "admin",
    email: "admin@wahatna.ae",
    fullName: "Wahatna System Administrator",
    role: "admin",
    employeeId: "ADM-0001",
    hazardScore: 0,
    streakDays: 0,
    totalReports: 0,
  },
];

async function seedUsers(): Promise<number[]> {
  const passwordHash = await hashPassword("wahatna2024");
  const ids: number[] = [];
  for (const u of DEMO_USERS) {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`${usersTable.username} = ${u.username}`)
      .limit(1);
    if (existing[0]) {
      ids.push(existing[0].id);
      continue;
    }
    const inserted = await db
      .insert(usersTable)
      .values({ ...u, passwordHash })
      .returning({ id: usersTable.id });
    ids.push(inserted[0]!.id);
  }
  return ids;
}

async function seedIncidents(userIds: number[]): Promise<void> {
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(incidentsTable);
  const existingCount = countRows[0]?.count ?? 0;
  if (existingCount >= 15) return;

  const rng = mulberry32(42);
  const now = Date.now();

  for (let i = 0; i < 20; i++) {
    const [threatClass, threatLabel, sev, sevLabel] = rngChoice(
      rng,
      THREAT_CLASSES,
    );
    const [baseLat, baseLon, locName] = rngChoice(rng, UAE_LOCATIONS);
    const lat = baseLat + rngUniform(rng, -0.02, 0.02);
    const lon = baseLon + rngUniform(rng, -0.02, 0.02);

    const createdAt = new Date(now - rngInt(rng, 0, 72) * 3600 * 1000);
    const status = rngChoice(rng, STATUSES);
    const userId = userIds.length ? rngChoice(rng, userIds) : null;

    await db.insert(incidentsTable).values({
      userId,
      lat: Math.round(lat * 100000) / 100000,
      lon: Math.round(lon * 100000) / 100000,
      locationName: locName,
      threatClass,
      threatLabel,
      confidence: Math.round(rngUniform(rng, 0.65, 0.97) * 1000) / 1000,
      severity: sev,
      severityLabel: sevLabel,
      secondaryThreats: JSON.stringify(
        rngSample(rng, SECONDARY_POOL, rngInt(rng, 1, 2)),
      ),
      heatIndexEstimate:
        rng() > 0.4 ? Math.round(rngUniform(rng, 36.0, 49.5) * 10) / 10 : null,
      riskLevel: RISK_LEVELS[sev]!,
      riskScore: sev,
      assessmentSummary: `A ${threatLabel.toLowerCase()} event was detected at ${locName}. Field worker safety protocols have been activated per MOHRE guidelines.`,
      recommendedProtocol:
        "Follow site evacuation procedure and contact relevant authority.",
      regulatoryReference: "MOHRE Federal Decree-Law No. 33 of 2021",
      status,
      createdAt,
      updatedAt: createdAt,
    });
  }
}

export async function runSeed(): Promise<void> {
  const userIds = await seedUsers();
  await seedIncidents(userIds);
}
