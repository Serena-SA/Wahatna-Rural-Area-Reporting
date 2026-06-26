/**
 * heat.ts — MOHRE outdoor work heat-ban logic and temperature simulation.
 *
 * MOHRE bans outdoor work 12:30–15:00 GST (UTC+4), 15 June – 15 September.
 */

export function isHeatBanActive(now: Date = new Date()): boolean {
  // GST is UTC+4
  const gstHour = (now.getUTCHours() + 4) % 24;
  const gstMinute = now.getUTCMinutes();
  const month = now.getUTCMonth() + 1; // 1-12
  const day = now.getUTCDate();

  const inBanSeason =
    (month === 6 && day >= 15) ||
    month === 7 ||
    month === 8 ||
    (month === 9 && day <= 15);

  const inBanHours =
    (gstHour > 12 && gstHour < 15) || (gstHour === 12 && gstMinute >= 30);

  return inBanSeason && inBanHours;
}

/**
 * Simulate a realistic current temperature for the Al Qua'a / UAE region,
 * varying by hour of day. Peak around 14:00 GST.
 */
export function simulateTemperatureC(now: Date = new Date()): number {
  const gstHour = (now.getUTCHours() + 4) % 24;
  const month = now.getUTCMonth() + 1;

  // Base seasonal temperature
  const summer = month >= 5 && month <= 9;
  const base = summer ? 38 : 26;
  const amplitude = summer ? 9 : 6;

  // Diurnal curve peaking at 14:00
  const phase = ((gstHour - 14) / 24) * 2 * Math.PI;
  const temp = base + amplitude * Math.cos(phase);
  return Math.round(temp * 10) / 10;
}

export function temperatureRiskLevel(tempC: number): string {
  if (tempC >= 45) return "critical";
  if (tempC >= 42) return "high";
  if (tempC >= 38) return "elevated";
  if (tempC >= 32) return "moderate";
  return "low";
}
