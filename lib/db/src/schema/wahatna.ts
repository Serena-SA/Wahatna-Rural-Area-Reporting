import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  role: text("role").notNull().default("user"),
  employeeId: text("employee_id"),
  shiftActive: boolean("shift_active").default(false),
  hazardScore: integer("hazard_score").default(0),
  streakDays: integer("streak_days").default(0),
  totalReports: integer("total_reports").default(0),
  lastKnownLat: doublePrecision("last_known_lat"),
  lastKnownLon: doublePrecision("last_known_lon"),
  pushToken: text("push_token"),
  preferredLanguage: text("preferred_language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  locationName: text("location_name"),
  threatClass: text("threat_class").notNull(),
  threatLabel: text("threat_label"),
  confidence: doublePrecision("confidence"),
  severity: integer("severity").default(3),
  severityLabel: text("severity_label").default("elevated"),
  secondaryThreats: text("secondary_threats"),
  heatIndexEstimate: doublePrecision("heat_index_estimate"),
  riskLevel: text("risk_level"),
  riskScore: integer("risk_score"),
  assessmentSummary: text("assessment_summary"),
  recommendedProtocol: text("recommended_protocol"),
  regulatoryReference: text("regulatory_reference"),
  dialectNote: text("dialect_note"),
  reportText: text("report_text"),
  imagePath: text("image_path"),
  imageFilename: text("image_filename"),
  status: text("status").default("pending_review"),
  // SLA & escalation
  dueAt: timestamp("due_at"),
  escalationRequired: boolean("escalation_required").default(false),
  escalatedAt: timestamp("escalated_at"),
  escalationLevel: integer("escalation_level").default(0),
  // Supervisor fields
  supervisorNotes: text("supervisor_notes"),
  rejectionReason: text("rejection_reason"),
  statusHistory: text("status_history"), // JSON string: [{status, timestamp, note}]
  // Location metadata
  locationSource: text("location_source"), // "gps" | "pin" | "address"
  addressDetails: text("address_details"),
  // Contact info
  phonePrimary: text("phone_primary"),
  phoneSecondary: text("phone_secondary"),
  // Resource dispatch (water / food) by a supervisor
  resourcesDispatchedAt: timestamp("resources_dispatched_at"),
  resourcesDispatchedBy: integer("resources_dispatched_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fleetWaypointsTable = pgTable("fleet_waypoints", {
  id: serial("id").primaryKey(),
  jobId: text("job_id"),
  userId: integer("user_id").references(() => usersTable.id),
  transportMode: text("transport_mode"),
  totalDistanceKm: doublePrecision("total_distance_km"),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  label: text("label"),
  optimizedOrder: integer("optimized_order"),
  distanceToNextKm: doublePrecision("distance_to_next_km"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  incidentId: integer("incident_id").references(() => incidentsTable.id),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  reportText: text("report_text"),
  imageFilename: text("image_filename"),
  scoreAwarded: integer("score_awarded").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type Incident = typeof incidentsTable.$inferSelect;
export type InsertIncident = typeof incidentsTable.$inferInsert;
export type FleetWaypoint = typeof fleetWaypointsTable.$inferSelect;
export type InsertFleetWaypoint = typeof fleetWaypointsTable.$inferInsert;
export type Report = typeof reportsTable.$inferSelect;
export type InsertReport = typeof reportsTable.$inferInsert;
