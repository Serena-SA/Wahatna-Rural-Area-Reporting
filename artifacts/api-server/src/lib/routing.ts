import { logger } from "./logger";
import type { Coord } from "./optimizer";

// ─── OpenRouteService road routing ───────────────────────────────────────────
//
// Turns the optimizer's straight-line plan into a real road route that respects
// the means of transport. Walking, car, and service vehicle (truck) each follow
// a different road network and produce different distances/durations.
//
// Requires a free API key in the ORS_API_KEY env var (https://openrouteservice.org).
// When the key is missing or the call fails, callers fall back to the
// Haversine straight-line estimate so the feature degrades gracefully offline.

const ORS_BASE = "https://api.openrouteservice.org/v2/directions";
const REQUEST_TIMEOUT_MS = 8000;

export type RoutingProfile = "driving-car" | "driving-hgv" | "foot-walking";

/** Map a Wahatna transport mode to an ORS routing profile. */
export function modeToProfile(mode: string): RoutingProfile {
  if (mode === "walking") return "foot-walking";
  if (mode === "service_vehicle") return "driving-hgv"; // heavy goods vehicle
  return "driving-car";
}

export function routingEnabled(): boolean {
  return Boolean(process.env["ORS_API_KEY"]);
}

export interface RoadRoute {
  distanceKm: number;
  durationMin: number;
  /** Per-segment distance in km, one entry per consecutive coordinate pair. */
  legKm: number[];
  /** Road geometry as [lat, lon] points, ready for a Leaflet polyline. */
  geometry: [number, number][];
}

interface OrsDirectionsGeoJson {
  features?: {
    geometry?: { coordinates?: [number, number][] };
    properties?: {
      summary?: { distance?: number; duration?: number };
      segments?: { distance?: number; duration?: number }[];
    };
  }[];
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Fetch a road route through the given ordered coordinates for the transport mode.
 * Returns null (so the caller can fall back to straight-line) when routing is
 * disabled, the input is too small, or the ORS request fails.
 */
export async function getRoadRoute(coords: Coord[], mode: string): Promise<RoadRoute | null> {
  const apiKey = process.env["ORS_API_KEY"];
  if (!apiKey) return null;
  if (coords.length < 2) return null;

  const profile = modeToProfile(mode);
  // ORS expects [lon, lat]; our Coord is [lat, lon].
  const body = { coordinates: coords.map(([lat, lon]) => [lon, lat]), units: "km" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${ORS_BASE}/${profile}/geojson`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/geo+json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn({ status: res.status, profile, body: text.slice(0, 200) }, "ORS routing failed");
      return null;
    }
    const data = (await res.json()) as OrsDirectionsGeoJson;
    const feature = data.features?.[0];
    const summary = feature?.properties?.summary;
    if (!feature?.geometry?.coordinates || !summary) {
      logger.warn({ profile }, "ORS routing returned no geometry");
      return null;
    }
    const legKm = (feature.properties?.segments ?? []).map((s) => round(s.distance ?? 0, 4));
    const geometry: [number, number][] = feature.geometry.coordinates.map(
      ([lon, lat]) => [lat, lon],
    );
    return {
      distanceKm: round(summary.distance ?? 0, 4),
      durationMin: round((summary.duration ?? 0) / 60, 1),
      legKm,
      geometry,
    };
  } catch (err) {
    logger.warn({ err, profile }, "ORS routing error");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
