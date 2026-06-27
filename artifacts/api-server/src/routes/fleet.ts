import { Router, type IRouter, type Response } from "express";
import { randomUUID } from "node:crypto";
import { eq, desc, sql } from "drizzle-orm";
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
  const userId = req.user?.id ?? null;

  // Persist optimized stops to DB
  await db.insert(fleetWaypointsTable).values(
    result.optimized_route.stops.map((item) => ({
      jobId,
      userId,
      transportMode,
      totalDistanceKm: result.optimized_route.total_distance_km,
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

router.get("/fleet/jobs", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ detail: "Unauthorized" });
    return;
  }

  // Return recent jobs grouped by job_id for this user
  const rows = await db
    .select({
      jobId: fleetWaypointsTable.jobId,
      transportMode: fleetWaypointsTable.transportMode,
      totalDistanceKm: fleetWaypointsTable.totalDistanceKm,
      stopCount: sql<number>`cast(count(*) as integer)`,
      createdAt: sql<string>`min(${fleetWaypointsTable.createdAt})`,
    })
    .from(fleetWaypointsTable)
    .where(eq(fleetWaypointsTable.userId, userId))
    .groupBy(
      fleetWaypointsTable.jobId,
      fleetWaypointsTable.transportMode,
      fleetWaypointsTable.totalDistanceKm,
    )
    .orderBy(desc(sql`min(${fleetWaypointsTable.createdAt})`))
    .limit(20);

  res.json({ jobs: rows });
});

router.get("/fleet/jobs/:jobId", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ detail: "Unauthorized" });
    return;
  }
  const jobId = String(req.params.jobId);

  const stops = await db
    .select()
    .from(fleetWaypointsTable)
    .where(
      sql`${fleetWaypointsTable.jobId} = ${jobId} AND ${fleetWaypointsTable.userId} = ${userId}`
    )
    .orderBy(fleetWaypointsTable.optimizedOrder);

  if (stops.length === 0) {
    res.status(404).json({ detail: "Job not found" });
    return;
  }

  res.json({ job_id: jobId, stops });
});

export default router;
