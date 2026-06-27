import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, lt, not, inArray } from "drizzle-orm";
import { db, incidentsTable, usersTable, reportsTable } from "@workspace/db";
import { requireAuth, requireSupervisor, type AuthedRequest } from "../lib/auth";
import { reportDict } from "../lib/serialize";

const router: IRouter = Router();

const ACTIVE_STATUSES = [
  "pending_review",
  "under_review",
  "assigned",
  "late",
];

/** Mark overdue incidents: sets status=late and escalation_required=true */
async function markOverdueIncidents(): Promise<void> {
  const now = new Date();
  await db
    .update(incidentsTable)
    .set({
      status: "late",
      escalationRequired: true,
      updatedAt: now,
    })
    .where(
      and(
        lt(incidentsTable.dueAt, now),
        not(inArray(incidentsTable.status as any, ["completed", "rejected", "resolved"])),
        not(eq(incidentsTable.status, "late")),
      ),
    );
}

/** LEFT JOIN incidents with users and return combined rows */
async function fetchIncidentsWithReporter() {
  return db
    .select({ incident: incidentsTable, reporter_username: usersTable.username })
    .from(incidentsTable)
    .leftJoin(usersTable, eq(incidentsTable.userId, usersTable.id))
    .orderBy(
      desc(incidentsTable.escalationRequired),
      desc(incidentsTable.severity),
      desc(incidentsTable.createdAt),
    );
}

function enrichedReportDict(
  incident: typeof incidentsTable.$inferSelect,
  reporterUsername: string | null,
): Record<string, unknown> {
  return { ...reportDict(incident), reporter_username: reporterUsername };
}

/** GET /api/supervisor/dashboard */
router.get(
  "/supervisor/dashboard",
  requireAuth,
  requireSupervisor,
  async (_req: Request, res: Response) => {
    await markOverdueIncidents();

    const allRows = await fetchIncidentsWithReporter();

    const counts: Record<string, number> = {};
    let criticalCount = 0;
    let lateCount = 0;

    for (const { incident: r } of allRows) {
      const s = r.status ?? "pending_review";
      counts[s] = (counts[s] ?? 0) + 1;
      if ((r.severity ?? 0) >= 7) criticalCount++;
      if (s === "late") lateCount++;
    }

    const activeIncidents = allRows
      .filter(({ incident: r }) => ACTIVE_STATUSES.includes(r.status ?? "pending_review"))
      .slice(0, 20)
      .map(({ incident, reporter_username }) => enrichedReportDict(incident, reporter_username));

    res.json({
      counts,
      critical_count: criticalCount,
      late_count: lateCount,
      total: allRows.length,
      active_incidents: activeIncidents,
    });
  },
);

/** GET /api/supervisor/reports — filterable report list */
router.get(
  "/supervisor/reports",
  requireAuth,
  requireSupervisor,
  async (req: Request, res: Response) => {
    await markOverdueIncidents();

    const q = req.query as Record<string, string | undefined>;
    const statusFilter = q["status"];
    const severityMin = q["severity_min"] ? Number(q["severity_min"]) : undefined;
    const severityMax = q["severity_max"] ? Number(q["severity_max"]) : undefined;
    const lateOnly = q["late_only"] === "true";
    const categoryFilter = q["category"];
    const dateFrom = q["date_from"] ? new Date(q["date_from"]) : undefined;

    let rows = await fetchIncidentsWithReporter();

    if (statusFilter && statusFilter !== "all") {
      rows = rows.filter(({ incident: r }) => r.status === statusFilter);
    }
    if (severityMin !== undefined && !Number.isNaN(severityMin)) {
      rows = rows.filter(({ incident: r }) => (r.severity ?? 0) >= severityMin);
    }
    if (severityMax !== undefined && !Number.isNaN(severityMax)) {
      rows = rows.filter(({ incident: r }) => (r.severity ?? 0) <= severityMax);
    }
    if (lateOnly) {
      rows = rows.filter(({ incident: r }) => r.status === "late");
    }
    if (categoryFilter && categoryFilter !== "all") {
      rows = rows.filter(({ incident: r }) => r.threatClass === categoryFilter);
    }
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
      rows = rows.filter(({ incident: r }) => r.createdAt && r.createdAt >= dateFrom);
    }

    res.json({
      reports: rows.map(({ incident, reporter_username }) => enrichedReportDict(incident, reporter_username)),
      total: rows.length,
    });
  },
);

/** PATCH /api/supervisor/reports/:id/status */
router.patch(
  "/supervisor/reports/:id/status",
  requireAuth,
  requireSupervisor,
  async (req: AuthedRequest, res: Response) => {
    const incidentId = Number(req.params["id"]);
    if (Number.isNaN(incidentId)) {
      res.status(400).json({ detail: "Invalid report id" });
      return;
    }

    const { status, note, rejection_reason } = req.body ?? {};
    const validStatuses = [
      "pending_review",
      "under_review",
      "assigned",
      "completed",
      "rejected",
      "late",
    ];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ detail: `status must be one of: ${validStatuses.join(", ")}` });
      return;
    }
    if (status === "rejected" && !rejection_reason) {
      res.status(400).json({ detail: "rejection_reason is required when rejecting a report" });
      return;
    }

    const existing = await db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.id, incidentId))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ detail: "Report not found" });
      return;
    }

    let history: Array<{ status: string; timestamp: string; note?: string }> = [];
    try {
      if (existing[0].statusHistory) {
        history = JSON.parse(existing[0].statusHistory);
      }
    } catch {
      history = [];
    }
    history.push({ status, timestamp: new Date().toISOString(), note: note ?? undefined });

    const updates: Record<string, unknown> = {
      status,
      statusHistory: JSON.stringify(history),
      updatedAt: new Date(),
    };
    if (status === "rejected" && rejection_reason) {
      updates["rejectionReason"] = rejection_reason;
    }

    const updated = await db
      .update(incidentsTable)
      .set(updates as any)
      .where(eq(incidentsTable.id, incidentId))
      .returning();

    // Fetch reporter username for the response
    const reporterRow = updated[0]?.userId
      ? await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, updated[0].userId)).limit(1)
      : [];

    res.json(enrichedReportDict(updated[0]!, reporterRow[0]?.username ?? null));
  },
);

/** PATCH /api/supervisor/reports/:id/notes */
router.patch(
  "/supervisor/reports/:id/notes",
  requireAuth,
  requireSupervisor,
  async (req: Request, res: Response) => {
    const incidentId = Number(req.params["id"]);
    if (Number.isNaN(incidentId)) {
      res.status(400).json({ detail: "Invalid report id" });
      return;
    }

    const { notes } = req.body ?? {};
    if (typeof notes !== "string") {
      res.status(400).json({ detail: "notes field is required" });
      return;
    }

    const updated = await db
      .update(incidentsTable)
      .set({ supervisorNotes: notes, updatedAt: new Date() } as any)
      .where(eq(incidentsTable.id, incidentId))
      .returning();

    if (!updated[0]) {
      res.status(404).json({ detail: "Report not found" });
      return;
    }

    const reporterRow = updated[0]?.userId
      ? await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, updated[0].userId)).limit(1)
      : [];

    res.json(enrichedReportDict(updated[0], reporterRow[0]?.username ?? null));
  },
);

/** PATCH /api/supervisor/reports/:id/dispatch — record that water/food was sent */
router.patch(
  "/supervisor/reports/:id/dispatch",
  requireAuth,
  requireSupervisor,
  async (req: AuthedRequest, res: Response) => {
    const incidentId = Number(req.params["id"]);
    if (Number.isNaN(incidentId)) {
      res.status(400).json({ detail: "Invalid report id" });
      return;
    }

    const updated = await db
      .update(incidentsTable)
      .set({
        resourcesDispatchedAt: new Date(),
        resourcesDispatchedBy: req.user?.id ?? null,
        updatedAt: new Date(),
      } as any)
      .where(eq(incidentsTable.id, incidentId))
      .returning();

    if (!updated[0]) {
      res.status(404).json({ detail: "Report not found" });
      return;
    }

    const reporterRow = updated[0].userId
      ? await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, updated[0].userId)).limit(1)
      : [];

    res.json(enrichedReportDict(updated[0], reporterRow[0]?.username ?? null));
  },
);

/** DELETE /api/supervisor/reports/:id — permanently remove a report (hard delete) */
router.delete(
  "/supervisor/reports/:id",
  requireAuth,
  requireSupervisor,
  async (req: Request, res: Response) => {
    const incidentId = Number(req.params["id"]);
    if (Number.isNaN(incidentId)) {
      res.status(400).json({ detail: "Invalid report id" });
      return;
    }

    const existing = await db
      .select({ id: incidentsTable.id })
      .from(incidentsTable)
      .where(eq(incidentsTable.id, incidentId))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ detail: "Report not found" });
      return;
    }

    // Remove dependent reports rows first (FK), then the incident itself.
    await db.transaction(async (tx) => {
      await tx.delete(reportsTable).where(eq(reportsTable.incidentId, incidentId));
      await tx.delete(incidentsTable).where(eq(incidentsTable.id, incidentId));
    });

    res.json({ deleted: incidentId });
  },
);

/** POST /api/supervisor/reports/clear-demo — delete all seeded demo reports.
 *  Seed rows are flagged with is_seed=true at seed time; real community reports
 *  (which now carry a real YOLO confidence) are never matched. */
router.post(
  "/supervisor/reports/clear-demo",
  requireAuth,
  requireSupervisor,
  async (_req: Request, res: Response) => {
    const demo = await db
      .select({ id: incidentsTable.id })
      .from(incidentsTable)
      .where(eq(incidentsTable.isSeed, true));
    const ids = demo.map((d) => d.id);

    if (ids.length > 0) {
      await db.transaction(async (tx) => {
        await tx.delete(reportsTable).where(inArray(reportsTable.incidentId, ids));
        await tx.delete(incidentsTable).where(inArray(incidentsTable.id, ids));
      });
    }

    res.json({ deleted: ids.length });
  },
);

export default router;
