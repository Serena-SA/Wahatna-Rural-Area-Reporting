import { Router, type IRouter, type Response, type NextFunction } from "express";
import multer from "multer";
import { and, desc, eq } from "drizzle-orm";
import { db, usersTable, incidentsTable, reportsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { analyzeCategory, SEVERITY_TO_LABEL } from "../lib/vision";
import { assessIncident, calculateDueAt } from "../lib/agent";
import { reportDict } from "../lib/serialize";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image uploads are allowed"));
    }
  },
});

function uploadImage(req: AuthedRequest, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        detail:
          err.code === "LIMIT_FILE_SIZE" ? "Image exceeds 10MB limit" : "Invalid upload",
      });
      return;
    }
    if (err) {
      res.status(400).json({ detail: err instanceof Error ? err.message : "Invalid upload" });
      return;
    }
    next();
  });
}

router.post(
  "/report",
  requireAuth,
  uploadImage,
  async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const body = req.body ?? {};

    const lat = Number.parseFloat(body.lat);
    const lon = Number.parseFloat(body.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      res.status(400).json({ detail: "Valid lat and lon are required" });
      return;
    }

    const reportText: string = body.report_text ?? "";
    const category: string | undefined = body.category;
    const locationSource: string | undefined = body.location_source;
    const addressDetails: string | undefined = body.address_details;
    const phonePrimary: string | undefined = body.phone_primary;
    const phoneSecondary: string | undefined = body.phone_secondary;
    const imageFile = req.file;
    const imageFilename = imageFile?.originalname ?? null;

    const vision = analyzeCategory(category, !!imageFile);
    const assessment = assessIncident(vision, lat, lon, reportText);
    const dueAt = calculateDueAt(vision.severity);

    const initialHistory = JSON.stringify([
      {
        status: "pending_review",
        timestamp: new Date().toISOString(),
        note: "Report submitted by community reporter",
      },
    ]);

    const insertedIncident = await db
      .insert(incidentsTable)
      .values({
        userId: user.id,
        lat,
        lon,
        threatClass: vision.threat_class,
        threatLabel: vision.threat_label,
        confidence: vision.confidence,
        severity: vision.severity,
        severityLabel: SEVERITY_TO_LABEL[vision.severity] ?? "elevated",
        secondaryThreats: JSON.stringify(vision.secondary_threats),
        heatIndexEstimate: vision.heat_index_estimate,
        riskLevel: assessment.risk_level,
        riskScore: assessment.risk_score,
        assessmentSummary: assessment.assessment_summary,
        recommendedProtocol: assessment.recommended_protocol,
        regulatoryReference: assessment.regulatory_reference,
        dialectNote: assessment.dialect_note,
        reportText,
        imageFilename,
        status: "pending_review",
        dueAt,
        locationSource: locationSource ?? null,
        addressDetails: addressDetails ?? null,
        phonePrimary: phonePrimary ?? null,
        phoneSecondary: phoneSecondary ?? null,
        statusHistory: initialHistory,
      })
      .returning();
    const incident = insertedIncident[0]!;

    const scoreDelta = vision.severity * 50;
    await db
      .insert(reportsTable)
      .values({
        userId: user.id,
        incidentId: incident.id,
        lat,
        lon,
        reportText,
        imageFilename,
        scoreAwarded: scoreDelta,
      })
      .returning();

    const newScore = (user.hazardScore ?? 0) + scoreDelta;
    await db
      .update(usersTable)
      .set({
        hazardScore: newScore,
        totalReports: (user.totalReports ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    res.status(201).json({
      incident_id: incident.id,
      reference: `WAH-${String(incident.id).padStart(5, "0")}`,
      due_at: dueAt.toISOString(),
      vision,
      assessment: {
        risk_level: assessment.risk_level,
        risk_score: assessment.risk_score,
        assessment_summary: assessment.assessment_summary,
        recommended_protocol: assessment.recommended_protocol,
        regulatory_reference: assessment.regulatory_reference,
        dialect_note: assessment.dialect_note,
        context_sources: assessment.context_sources,
      },
      score_awarded: scoreDelta,
      worker_total_score: newScore,
      created_at: incident.createdAt ? incident.createdAt.toISOString() : new Date().toISOString(),
    });
  },
);

/** GET /api/reports/my — returns the authenticated user's own reports */
router.get("/reports/my", requireAuth, async (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const rows = await db
    .select()
    .from(incidentsTable)
    .where(eq(incidentsTable.userId, user.id))
    .orderBy(desc(incidentsTable.createdAt))
    .limit(50);

  res.json({ reports: rows.map(reportDict) });
});

/** GET /api/reports/:id — returns a single report if it belongs to the user (or supervisor) */
router.get("/reports/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const incidentId = Number(req.params["id"]);
  if (Number.isNaN(incidentId)) {
    res.status(400).json({ detail: "Invalid report id" });
    return;
  }

  const isSupervisor = user.role === "supervisor" || user.role === "admin";
  const rows = await db
    .select()
    .from(incidentsTable)
    .where(
      isSupervisor
        ? eq(incidentsTable.id, incidentId)
        : and(eq(incidentsTable.id, incidentId), eq(incidentsTable.userId, user.id)),
    )
    .limit(1);

  const incident = rows[0];
  if (!incident) {
    res.status(404).json({ detail: "Report not found" });
    return;
  }

  res.json(reportDict(incident));
});

export default router;
