// heat.ts — client-side MOHRE heat-ban logic + live Al Qua'a temperature.
//
// Mirrors the server's heat.ts ban rule (MOHRE outdoor-work ban 12:30–15:00 GST,
// 15 June – 15 September) so the UI can show ban status without a round-trip, and
// fetches the REAL current temperature at Al Qua'a from Open-Meteo (free, no key).

export const AL_QUAA = { lat: 23.83, lon: 55.73, name: "Al Qua'a" } as const;

const BAN_START_MIN = 12 * 60 + 30; // 12:30 GST
const BAN_END_MIN = 15 * 60; // 15:00 GST

function gstMinutesOfDay(now: Date): number {
  const gstHour = (now.getUTCHours() + 4) % 24;
  return gstHour * 60 + now.getUTCMinutes();
}

function inBanSeason(now: Date): boolean {
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  return (
    (month === 6 && day >= 15) ||
    month === 7 ||
    month === 8 ||
    (month === 9 && day <= 15)
  );
}

export function isHeatBanActive(now: Date = new Date()): boolean {
  if (!inBanSeason(now)) return false;
  const m = gstMinutesOfDay(now);
  return m >= BAN_START_MIN && m < BAN_END_MIN;
}

export interface BanStatus {
  /** Ban currently in effect. */
  active: boolean;
  /** In ban season at all (15 Jun – 15 Sep). */
  inSeason: boolean;
  /** Minutes until the ban starts today (null if active or already past today). */
  minutesUntilStart: number | null;
  /** Minutes until the ban ends (only when active). */
  minutesUntilEnd: number | null;
}

export function getBanStatus(now: Date = new Date()): BanStatus {
  const inSeason = inBanSeason(now);
  if (!inSeason) {
    return { active: false, inSeason: false, minutesUntilStart: null, minutesUntilEnd: null };
  }
  const m = gstMinutesOfDay(now);
  if (m < BAN_START_MIN) {
    return { active: false, inSeason: true, minutesUntilStart: BAN_START_MIN - m, minutesUntilEnd: null };
  }
  if (m < BAN_END_MIN) {
    return { active: true, inSeason: true, minutesUntilStart: null, minutesUntilEnd: BAN_END_MIN - m };
  }
  // After today's window — next ban is tomorrow 12:30.
  return { active: false, inSeason: true, minutesUntilStart: 1440 - m + BAN_START_MIN, minutesUntilEnd: null };
}

export type HeatRisk = "low" | "moderate" | "elevated" | "high" | "critical";

export function temperatureRiskLevel(tempC: number): HeatRisk {
  if (tempC >= 45) return "critical";
  if (tempC >= 42) return "high";
  if (tempC >= 38) return "elevated";
  if (tempC >= 32) return "moderate";
  return "low";
}

/** Live current temperature (°C) at Al Qua'a from Open-Meteo. null on failure. */
export async function fetchAlQuaaTempC(): Promise<number | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${AL_QUAA.lat}` +
    `&longitude=${AL_QUAA.lon}&current=temperature_2m`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { current?: { temperature_2m?: number } };
    const t = data?.current?.temperature_2m;
    return typeof t === "number" ? Math.round(t * 10) / 10 : null;
  } catch {
    return null;
  }
}
