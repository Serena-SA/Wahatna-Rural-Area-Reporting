import { Router, type IRouter, type Response } from "express";
import { randomUUID } from "node:crypto";
import { db, fleetWaypointsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { optimizeFleetRoute, type Coord, type FleetWaypoint } from "../lib/optimizer";

const router: IRouter = Router();

interface WaypointInput {
  lat: number;
  lon: number;
  label?: string;
  priority?: number; // 1–5 (5 = critical)
}

const VALID_MODES = ["walking", "car", "service_vehicle"] as const;
type TransportMode = (typeof VALID_MODES)[number];

router.post("/fleet/optimize", requireAuth, async (req: AuthedRequest, res: Response) => {
  const body = req.body ?? {};

  // Start location (GPS or manual)
  const startRaw = body.start as { lat?: unknown; lon?: unknown } | undefined;
  if (!startRaw || typeof startRaw.lat !== "number" || typeof startRaw.lon !== "number") {
    res.status(400).json({ detail: "start.lat and start.lon are required" });
    return;
  }
  const start: Coord = [Number(startRaw.lat), Number(startRaw.lon)];

  // Destination waypoints
  const waypointsRaw: WaypointInput[] = body.waypoints ?? [];
  if (!Array.isArray(waypointsRaw) || waypointsRaw.length < 1) {
    res.status(400).json({ detail: "At least 1 destination waypoint required" });
    return;
  }
  if (waypointsRaw.length > 50) {
    res.status(400).json({ detail: "Maximum 50 waypoints per request" });
    return;
  }

  // Transport mode
  const rawMode = String(body.transport_mode ?? "car");
  const transportMode: TransportMode = VALID_MODES.includes(rawMode as TransportMode)
    ? (rawMode as TransportMode)
    : "car";

  const destinations: FleetWaypoint[] = waypointsRaw.map((wp, i) => ({
    lat: Number(wp.lat),
    lon: Number(wp.lon),
    label: wp.label || `Stop ${i + 1}`,
    priority: wp.priority != null ? Number(wp.priority) : 3,
  }));

  const result = optimizeFleetRoute(start, destinations, transportMode, 100, 200);
  const jobId = randomUUID().slice(0, 8);

  // Persist optimized route to DB
  await db.insert(fleetWaypointsTable).values(
    result.optimized_route.map((item) => ({
      jobId,
      lat: item.lat,
      lon: item.lon,
      label: item.label,
      optimizedOrder: item.order,
      distanceToNextKm: item.distance_to_next_km,
    })),
  );

  res.json({
    job_id: jobId,
    transport_mode: result.transport_mode,
    original_route: result.original_route,
    optimized_route: result.optimized_route,
    priority_explanation: result.priority_explanation,
    metrics: result.metrics,
  });
});

export default router;
