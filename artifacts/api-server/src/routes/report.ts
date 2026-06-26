import { Router, type IRouter, type Response, type NextFunction } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db, usersTable, incidentsTable, reportsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { analyzeCategory, SEVERITY_TO_LABEL } from "../lib/vision";
import { assessIncident } from "../lib/agent";

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
      res.status(400).json({ detail: err.code === "LIMIT_FILE_SIZE" ? "Image exceeds 10MB limit" : "Invalid upload" });
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
    const imageFile = req.file;
    const imageFilename = imageFile?.originalname ?? null;

    // STUB: classify from the worker-selected category (no CV model).
    const vision = analyzeCategory(category, !!imageFile);

    // Local rule-based RAG assessment.
    const assessment = assessIncident(vision, lat, lon, reportText);

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
        status: "active",
      })
      .returning();
    const incident = insertedIncident[0]!;

    const scoreDelta = vision.severity * 50;
    const insertedReport = await db
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
    const reportRecord = insertedReport[0]!;

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
      report_id: reportRecord.id,
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
      created_at: incident.createdAt
        ? incident.createdAt.toISOString()
        : new Date().toISOString(),
    });
  },
);

export default router;
