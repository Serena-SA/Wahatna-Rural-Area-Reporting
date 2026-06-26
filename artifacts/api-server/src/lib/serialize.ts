import type { User, Incident } from "@workspace/db";

export function userDict(user: User): Record<string, unknown> {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    employee_id: user.employeeId,
    hazard_score: user.hazardScore,
    score: user.hazardScore, // mobile contract alias
    streak_days: user.streakDays,
    total_reports: user.totalReports,
    shift_active: user.shiftActive,
    last_known_lat: user.lastKnownLat,
    last_known_lon: user.lastKnownLon,
  };
}

/** Maps an incident to the shape the mobile dashboard expects. */
export function dashboardIncidentDict(
  incident: Incident,
): Record<string, unknown> {
  return {
    id: incident.id,
    title: incident.threatLabel || incident.threatClass,
    description:
      incident.assessmentSummary || incident.reportText || incident.locationName || "",
    status: incident.status,
    severity: incident.severity,
    risk_level: (incident.riskLevel || "").toLowerCase(),
    latitude: incident.lat,
    longitude: incident.lon,
    location_name: incident.locationName,
    threat_class: incident.threatClass,
    created_at: incident.createdAt
      ? incident.createdAt.toISOString()
      : null,
  };
}
