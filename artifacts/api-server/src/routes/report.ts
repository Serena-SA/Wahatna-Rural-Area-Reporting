import path from "node:path";
import { Router, type IRouter, type Response, type NextFunction } from "express";
import multer from "multer";
import { and, desc, eq } from "drizzle-orm";
import { db, usersTable, incidentsTable, reportsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { analyzeCategory, SEVERITY_TO_LABEL } from "../lib/vision";
import { assessIncident, calculateDueAt } from "../lib/agent";
import { detectHazards, type Detection } from "../lib/yolo";
import { assessWithK2, k2Available } from "../lib/k2think";
import { reportDict } from "../lib/serialize";

const router: IRouter = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage: diskStorage,
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

/** Parse detections that may arrive as a JSON string (FormData) or array (JSON body). */
function parseDetections(raw: unknown): Detection[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (d) => d && typeof d.label === "string" && Array.isArray(d.box) && d.box.length === 4,
    ) as Detection[];
  } catch {
    return [];
  }
}

/**
 * POST /api/report/analyze — Stage 1 of an online report: upload the photo,
 * run the local YOLO model, and return the detections (with normalised boxes)
 * so the app can draw bounding boxes before the K2 Think assessment runs.
 * Does NOT create an incident.
 */
router.post(
  "/report/analyze",
  requireAuth,
  uploadImage,
  async (req: AuthedRequest, res: Response) => {
    const imageFile = req.file;
    if (!imageFile) {
      res.status(400).json({ detail: "An image is required for analysis" });
      return;
    }
    const result = await detectHazards(path.join(UPLOADS_DIR, imageFile.filename));
    res.json({
      image_filename: imageFile.filename,
      available: result.available,
      width: result.width,
      height: result.height,
      detections: result.detections,
    });
  },
);

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
    const userCategory: string = body.category ?? "other";
    const locationSource: string | undefined = body.location_source;
    const addressDetails: string | undefined = body.address_details;
    const phonePrimary: string | undefined = body.phone_primary;
    const phoneSecondary: string | undefined = body.phone_secondary;

    // The image may arrive fresh (multipart, e.g. offline-sync) or already saved
    // by /report/analyze (referenced by filename, no re-upload).
    const imageFile = req.file;
    const imageFilename: string | null =
      imageFile?.filename ?? (typeof body.image_filename === "string" ? body.image_filename : null);

    // Detections: trust the ones already computed by /analyze; otherwise run YOLO
    // now on the saved file (covers offline-sync, which never hit /analyze).
    let detections = parseDetections(body.detections);
    if (detections.length === 0 && imageFilename && body.detections === undefined) {
      const yolo = await detectHazards(path.join(UPLOADS_DIR, imageFilename));
      detections = yolo.detections;
    }
    const hasDetections = detections.length > 0;
    const topConfidence = hasDetections ? detections[0]!.confidence : null;

    // K2 Think V2: select hazard type, severity, and government resolution ETA.
    // Falls back to the local rule-based agent if no key or the call fails.
    let k2 = null;
    if (k2Available()) {
      try {
        k2 = await assessWithK2({ detections, description: reportText, userCategory });
      } catch (err) {
        req.log?.warn?.({ err }, "K2 Think failed; using local assessment");
      }
    }

    const chosenCategory = k2?.hazard_category ?? userCategory;
    const vision = analyzeCategory(chosenCategory, !!imageFilename);
    const severity = k2?.severity ?? vision.severity;
    vision.severity = severity; // so the local summary reflects the final severity
    vision.confidence = topConfidence;

    const assessment = assessIncident(vision, lat, lon, reportText);
    const dueAt = k2
      ? new Date(Date.now() + k2.eta_hours * 60 * 60 * 1000)
      : calculateDueAt(severity);
    const analysisSource = `${hasDetections ? "yolo" : "user"}+${k2 ? "k2" : "local"}`;
    const assessmentSummary = k2?.reasoning
      ? `${k2.reasoning} ${assessment.assessment_summary}`
      : assessment.assessment_summary;
    const recommendedProtocol = k2?.recommended_action || assessment.recommended_protocol;

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
        confidence: topConfidence,
        detections: hasDetections ? JSON.stringify(detections) : null,
        analysisSource,
        etaText: k2?.eta_text ?? null,
        isSeed: false,
        severity,
        severityLabel: SEVERITY_TO_LABEL[severity] ?? "elevated",
        secondaryThreats: JSON.stringify(vision.secondary_threats),
        heatIndexEstimate: vision.heat_index_estimate,
        riskLevel: assessment.risk_level,
        riskScore: severity,
        assessmentSummary,
        recommendedProtocol,
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

    const scoreDelta = severity * 50;
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
      vision: {
        threat_class: vision.threat_class,
        threat_label: vision.threat_label,
        confidence: topConfidence,
        chosen_category: chosenCategory,
        detections,
        severity,
        severity_label: SEVERITY_TO_LABEL[severity] ?? "elevated",
      },
      assessment: {
        risk_level: assessment.risk_level,
        risk_score: severity,
        assessment_summary: assessmentSummary,
        recommended_protocol: recommendedProtocol,
        regulatory_reference: assessment.regulatory_reference,
        eta_text: k2?.eta_text ?? null,
        analysis_source: analysisSource,
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
