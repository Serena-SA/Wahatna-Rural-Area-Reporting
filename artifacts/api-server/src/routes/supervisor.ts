import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, lt, not, inArray, or } from "drizzle-orm";
import { db, incidentsTable } from "@workspace/db";
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

/** GET /api/supervisor/dashboard */
router.get(
  "/supervisor/dashboard",
  requireAuth,
  requireSupervisor,
  async (_req: Request, res: Response) => {
    await markOverdueIncidents();

    const rows = await db.select().from(incidentsTable).orderBy(desc(incidentsTable.createdAt));

    const counts: Record<string, number> = {};
    let criticalCount = 0;
    let lateCount = 0;

    for (const r of rows) {
      const s = r.status ?? "pending_review";
      counts[s] = (counts[s] ?? 0) + 1;
      if ((r.severity ?? 0) >= 5) criticalCount++;
      if (s === "late") lateCount++;
    }

    const activeIncidents = rows
      .filter((r) => ACTIVE_STATUSES.includes(r.status ?? "pending_review"))
      .slice(0, 20)
      .map(reportDict);

    res.json({
      counts,
      critical_count: criticalCount,
      late_count: lateCount,
      total: rows.length,
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
    const severityFilter = q["severity"] ? Number(q["severity"]) : undefined;
    const lateOnly = q["late_only"] === "true";
    const categoryFilter = q["category"];

    let rows = await db
      .select()
      .from(incidentsTable)
      .orderBy(desc(incidentsTable.escalationRequired), desc(incidentsTable.severity), desc(incidentsTable.createdAt));

    if (statusFilter && statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (severityFilter !== undefined && !Number.isNaN(severityFilter)) {
      rows = rows.filter((r) => r.severity === severityFilter);
    }
    if (lateOnly) {
      rows = rows.filter((r) => r.status === "late");
    }
    if (categoryFilter && categoryFilter !== "all") {
      rows = rows.filter((r) => r.threatClass === categoryFilter);
    }

    res.json({ reports: rows.map(reportDict), total: rows.length });
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

    res.json(reportDict(updated[0]!));
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

    res.json(reportDict(updated[0]));
  },
);

export default router;
