import { Router, type IRouter, type Response } from "express";
import { randomUUID } from "node:crypto";
import { eq, desc, sql } from "drizzle-orm";
import { db, fleetWaypointsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { optimizeFleetRoute, type Coord, type FleetWaypoint } from "../lib/optimizer";
import { getRoadRoute, routingEnabled } from "../lib/routing";

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

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

  // ── Real road routing (mode-aware) via OpenRouteService ──
  // Replace the straight-line estimate with an actual road route + geometry that
  // respects the means of transport. Falls back to the Haversine result when ORS
  // is unavailable (no key / offline / error), so the endpoint never hard-fails.
  let geometry: [number, number][] = [];
  let routed = false;
  if (routingEnabled()) {
    const optimizedSeq: Coord[] = [
      start,
      ...result.optimized_route.stops.map((s) => [s.lat, s.lon] as Coord),
    ];
    const orderChanged = result.optimized_route.stops.some((s, i) => s.original_index !== i);
    const originalSeq: Coord[] = [
      start,
      ...result.original_route.stops.map((s) => [s.lat, s.lon] as Coord),
    ];

    const [optRoad, origRoad] = await Promise.all([
      getRoadRoute(optimizedSeq, transportMode),
      orderChanged ? getRoadRoute(originalSeq, transportMode) : Promise.resolve(null),
    ]);

    if (optRoad) {
      routed = true;
      geometry = optRoad.geometry;
      result.optimized_route.total_distance_km = optRoad.distanceKm;
      result.optimized_route.estimated_time_min = optRoad.durationMin;
      // legKm[0] is start→stop1; stop i's distance-to-next is legKm[i+1].
      const lastIdx = result.optimized_route.stops.length - 1;
      result.optimized_route.stops.forEach((s, i) => {
        s.distance_to_next_km =
          i === lastIdx ? 0 : optRoad.legKm[i + 1] ?? s.distance_to_next_km;
      });

      // Unchanged order → original road route equals the optimized one.
      const origRoadEff = origRoad ?? optRoad;
      result.original_route.total_distance_km = origRoadEff.distanceKm;
      result.original_route.estimated_time_min = origRoadEff.durationMin;

      const saved = Math.max(0, origRoadEff.distanceKm - optRoad.distanceKm);
      const timeSaved = Math.max(0, origRoadEff.durationMin - optRoad.durationMin);
      result.metrics.distance_saved_km = round(saved, 4);
      result.metrics.time_saved_min = round(timeSaved, 1);
      result.metrics.improvement_pct = round(
        origRoadEff.distanceKm > 0 ? (saved / origRoadEff.distanceKm) * 100 : 0,
        2,
      );
      result.metrics.speed_kmh =
        optRoad.durationMin > 0
          ? Math.round(optRoad.distanceKm / (optRoad.durationMin / 60))
          : result.metrics.speed_kmh;
    }
  }

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
    routed,
    original_route: result.original_route,
    optimized_route: result.optimized_route,
    geometry,
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
