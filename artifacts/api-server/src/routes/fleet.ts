import { Router, type IRouter, type Response } from "express";
import { randomUUID } from "node:crypto";
import { db, fleetWaypointsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { optimize, haversine, type Coord } from "../lib/optimizer";

const router: IRouter = Router();

interface WaypointInput {
  lat: number;
  lon: number;
  label?: string;
}

router.post("/fleet/optimize", requireAuth, async (req: AuthedRequest, res: Response) => {
  const waypoints: WaypointInput[] = req.body?.waypoints ?? [];
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    res.status(400).json({ detail: "At least 2 waypoints required" });
    return;
  }
  if (waypoints.length > 50) {
    res.status(400).json({ detail: "Maximum 50 waypoints per request" });
    return;
  }

  const coords: Coord[] = waypoints.map((wp) => [Number(wp.lat), Number(wp.lon)]);
  const labels = waypoints.map((wp, i) => wp.label || `Waypoint ${i + 1}`);

  const result = optimize(coords, 100, 200);
  const jobId = randomUUID().slice(0, 8);

  const routeItems = result.optimizedRoute.map((coord, i) => {
    const nextCoord = result.optimizedRoute[(i + 1) % result.optimizedRoute.length]!;
    const distToNext = haversine(coord, nextCoord);
    const originalIndex = result.originalIndices[i]!;
    return {
      order: i + 1,
      lat: coord[0],
      lon: coord[1],
      label: labels[originalIndex]!,
      original_index: originalIndex,
      distance_to_next_km: Math.round(distToNext * 10000) / 10000,
    };
  });

  await db.insert(fleetWaypointsTable).values(
    routeItems.map((item) => ({
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
    optimized_route: routeItems,
    metrics: {
      total_distance_km: result.totalDistanceKm,
      initial_distance_km: result.initialDistanceKm,
      improvement_pct: result.improvementPct,
      generations_run: result.generationsRun,
      population_size: result.populationSize,
      elapsed_ms: result.elapsedMs,
    },
  });
});

export default router;
