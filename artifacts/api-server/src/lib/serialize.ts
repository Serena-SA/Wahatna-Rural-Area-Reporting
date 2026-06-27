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
    score: user.hazardScore,
    streak_days: user.streakDays,
    total_reports: user.totalReports,
    shift_active: user.shiftActive,
    last_known_lat: user.lastKnownLat,
    last_known_lon: user.lastKnownLon,
    preferred_language: user.preferredLanguage ?? "en",
  };
}

/** Full incident/report shape used by My Reports, supervisor, and detail endpoints. */
export function reportDict(incident: Incident): Record<string, unknown> {
  let statusHistory: unknown[] = [];
  try {
    if (incident.statusHistory) {
      statusHistory = JSON.parse(incident.statusHistory);
    }
  } catch {
    statusHistory = [];
  }

  return {
    id: incident.id,
    reference: `WAH-${String(incident.id).padStart(5, "0")}`,
    title: incident.threatLabel || incident.threatClass,
    threat_class: incident.threatClass,
    threat_label: incident.threatLabel,
    description: incident.reportText || incident.assessmentSummary || "",
    status: incident.status ?? "pending_review",
    severity: incident.severity ?? 3,
    severity_label: incident.severityLabel ?? "elevated",
    risk_level: (incident.riskLevel || "").toLowerCase(),
    latitude: incident.lat,
    longitude: incident.lon,
    location_name: incident.locationName,
    location_source: incident.locationSource,
    address_details: incident.addressDetails,
    phone_primary: incident.phonePrimary,
    phone_secondary: incident.phoneSecondary,
    image_filename: incident.imageFilename,
    image_url: incident.imageFilename ? `/uploads/${incident.imageFilename}` : null,
    assessment_summary: incident.assessmentSummary,
    recommended_protocol: incident.recommendedProtocol,
    regulatory_reference: incident.regulatoryReference,
    due_at: incident.dueAt ? incident.dueAt.toISOString() : null,
    escalation_required: incident.escalationRequired ?? false,
    escalation_level: incident.escalationLevel ?? 0,
    escalated_at: incident.escalatedAt ? incident.escalatedAt.toISOString() : null,
    supervisor_notes: incident.supervisorNotes,
    rejection_reason: incident.rejectionReason,
    status_history: statusHistory,
    created_at: incident.createdAt ? incident.createdAt.toISOString() : null,
    updated_at: incident.updatedAt ? incident.updatedAt.toISOString() : null,
  };
}

/** Backward-compatible dashboard incident shape (keeps existing mobile contract). */
export function dashboardIncidentDict(
  incident: Incident,
): Record<string, unknown> {
  return {
    ...reportDict(incident),
    // legacy aliases kept for backward compat
    description:
      incident.assessmentSummary || incident.reportText || incident.locationName || "",
  };
}
