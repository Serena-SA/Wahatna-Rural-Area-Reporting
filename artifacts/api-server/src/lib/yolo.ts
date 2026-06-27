/**
 * yolo.ts — thin client for the local YOLO detection service (detect_service.py).
 *
 * The Python service loads the trained model once and we call it per report.
 * Everything degrades gracefully: if the service is down (e.g. deps not yet
 * installed, or the user is effectively offline at the server), detection
 * returns `available: false` and the pipeline falls back to the user's chosen
 * category — exactly the "no detection → rely on user input" behaviour.
 */

const YOLO_URL = process.env.YOLO_SERVICE_URL || "http://127.0.0.1:8099";

export interface Detection {
  label: string;
  confidence: number;
  /** [x1, y1, x2, y2] normalised to 0..1 of the image dimensions. */
  box: [number, number, number, number];
}

export interface YoloResult {
  available: boolean;
  detections: Detection[];
  width: number;
  height: number;
}

const EMPTY: YoloResult = { available: false, detections: [], width: 0, height: 0 };

/** Run hazard detection on an already-saved image file (absolute path). */
export async function detectHazards(imagePath: string): Promise<YoloResult> {
  try {
    const res = await fetch(`${YOLO_URL}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_path: imagePath }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as Partial<YoloResult> & { ok?: boolean };
    if (!data.ok) return EMPTY;
    return {
      available: true,
      detections: Array.isArray(data.detections) ? data.detections : [],
      width: data.width ?? 0,
      height: data.height ?? 0,
    };
  } catch {
    return EMPTY;
  }
}

/** True if the YOLO service answers a health check. */
export async function yoloHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${YOLO_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
