export type Coord = [number, number]; // [lat, lon]
export type Route = number[]; // ordered indices into coords list

const EARTH_RADIUS_KM = 6371.0;
const PRIORITY_WEIGHT = 0.3; // km-equivalent penalty per position for highest priority

export function haversine(a: Coord, b: Coord): number {
  const lat1 = (a[0] * Math.PI) / 180;
  const lon1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const lon2 = (b[1] * Math.PI) / 180;
  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function totalDistance(route: Route, coords: Coord[]): number {
  let dist = 0.0;
  const n = route.length;
  for (let i = 0; i < n; i++) {
    dist += haversine(coords[route[i]!]!, coords[route[(i + 1) % n]!]!);
  }
  return dist;
}

/** Open-path distance: start → dests in route order, no return */
function openPathDistance(start: Coord, route: Route, destCoords: Coord[]): number {
  if (route.length === 0) return 0;
  let d = haversine(start, destCoords[route[0]!]!);
  for (let i = 0; i < route.length - 1; i++) {
    d += haversine(destCoords[route[i]!]!, destCoords[route[i + 1]!]!);
  }
  return d;
}

/** Priority-weighted fitness for open-path routing */
function openPathFitness(
  start: Coord,
  route: Route,
  destCoords: Coord[],
  priorities: number[],
): number {
  const dist = openPathDistance(start, route, destCoords);
  let penalty = 0;
  for (let pos = 0; pos < route.length; pos++) {
    const p = priorities[route[pos]!] ?? 1;
    // High-priority stops at later positions accumulate penalty
    penalty += p * pos * PRIORITY_WEIGHT;
  }
  return dist + penalty;
}

function randint(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function sample<T>(arr: T[], k: number): T[] {
  return shuffle(arr).slice(0, k);
}

function randomRoute(n: number): Route {
  return shuffle(Array.from({ length: n }, (_, i) => i));
}

function initializePopulation(popSize: number, n: number): Route[] {
  return Array.from({ length: popSize }, () => randomRoute(n));
}

function tournamentSelect(
  population: Route[],
  coords: Coord[],
  k: number,
): Route {
  const contestants = sample(population, Math.min(k, population.length));
  let best = contestants[0]!;
  let bestDist = totalDistance(best, coords);
  for (let i = 1; i < contestants.length; i++) {
    const d = totalDistance(contestants[i]!, coords);
    if (d < bestDist) {
      best = contestants[i]!;
      bestDist = d;
    }
  }
  return best;
}

/** Tournament selection using an arbitrary fitness function */
function tournamentSelectFn(
  population: Route[],
  fitness: (r: Route) => number,
  k: number,
): Route {
  const contestants = sample(population, Math.min(k, population.length));
  let best = contestants[0]!;
  let bestFit = fitness(best);
  for (let i = 1; i < contestants.length; i++) {
    const f = fitness(contestants[i]!);
    if (f < bestFit) {
      best = contestants[i]!;
      bestFit = f;
    }
  }
  return best;
}

function orderedCrossover(p1: Route, p2: Route): Route {
  const n = p1.length;
  const [a, b] = sample(
    Array.from({ length: n }, (_, i) => i),
    2,
  ).sort((x, y) => x - y) as [number, number];
  const child: Route = new Array(n).fill(-1);
  for (let i = a; i <= b; i++) child[i] = p1[i]!;
  const segmentSet = new Set(p1.slice(a, b + 1));
  const fillVals = p2.filter((x) => !segmentSet.has(x));
  let idx = 0;
  for (let i = 0; i < n; i++) {
    if (child[i] === -1) {
      child[i] = fillVals[idx]!;
      idx += 1;
    }
  }
  return child;
}

function mutate(route: Route, mutationRate: number): Route {
  const r = route.slice();
  for (let i = 0; i < r.length; i++) {
    if (Math.random() < mutationRate) {
      const j = randint(0, r.length - 1);
      [r[i], r[j]] = [r[j]!, r[i]!];
    }
  }
  return r;
}

export interface OptimizationResult {
  optimizedRoute: Coord[];
  originalIndices: Route;
  totalDistanceKm: number;
  initialDistanceKm: number;
  improvementPct: number;
  generationsRun: number;
  populationSize: number;
  elapsedMs: number;
}

function minBy(routes: Route[], coords: Coord[]): Route {
  let best = routes[0]!;
  let bestDist = totalDistance(best, coords);
  for (let i = 1; i < routes.length; i++) {
    const d = totalDistance(routes[i]!, coords);
    if (d < bestDist) {
      best = routes[i]!;
      bestDist = d;
    }
  }
  return best;
}

function minByFn(routes: Route[], fitness: (r: Route) => number): Route {
  let best = routes[0]!;
  let bestFit = fitness(best);
  for (let i = 1; i < routes.length; i++) {
    const f = fitness(routes[i]!);
    if (f < bestFit) {
      best = routes[i]!;
      bestFit = f;
    }
  }
  return best;
}

export function optimize(
  coords: Coord[],
  populationSize = 100,
  generations = 200,
  mutationRate = 0.02,
  tournamentK = 5,
): OptimizationResult {
  const tStart = Date.now();
  const n = coords.length;

  if (n <= 1) {
    return {
      optimizedRoute: coords,
      originalIndices: Array.from({ length: n }, (_, i) => i),
      totalDistanceKm: 0.0,
      initialDistanceKm: 0.0,
      improvementPct: 0.0,
      generationsRun: 0,
      populationSize,
      elapsedMs: 0,
    };
  }

  const actualGens = Math.min(generations, Math.max(50, n * 20));
  const actualPop = Math.min(populationSize, Math.max(20, n * 10));

  let population = initializePopulation(actualPop, n);
  let bestRoute = minBy(population, coords);
  let bestDist = totalDistance(bestRoute, coords);
  const initialDist = bestDist;

  for (let gen = 0; gen < actualGens; gen++) {
    const newPopulation: Route[] = [bestRoute.slice()];
    while (newPopulation.length < actualPop) {
      const p1 = tournamentSelect(population, coords, tournamentK);
      const p2 = tournamentSelect(population, coords, tournamentK);
      let child = orderedCrossover(p1, p2);
      child = mutate(child, mutationRate);
      newPopulation.push(child);
    }
    population = newPopulation;
    const candidate = minBy(population, coords);
    const candidateDist = totalDistance(candidate, coords);
    if (candidateDist < bestDist) {
      bestDist = candidateDist;
      bestRoute = candidate.slice();
    }
  }

  const optimizedCoords = bestRoute.map((i) => coords[i]!);
  const improvement =
    initialDist > 0 ? ((initialDist - bestDist) / initialDist) * 100 : 0.0;
  const elapsedMs = Date.now() - tStart;

  return {
    optimizedRoute: optimizedCoords,
    originalIndices: bestRoute,
    totalDistanceKm: round(bestDist, 4),
    initialDistanceKm: round(initialDist, 4),
    improvementPct: round(improvement, 2),
    generationsRun: actualGens,
    populationSize: actualPop,
    elapsedMs,
  };
}

// ─── Fleet route optimizer with priority weighting ───────────────────────────

export interface FleetWaypoint {
  lat: number;
  lon: number;
  label?: string;
  priority?: number; // 1–5 where 5 = critical
}

export interface FleetRouteStop {
  order: number;
  lat: number;
  lon: number;
  label: string;
  original_index: number;
  distance_to_next_km: number;
}

export interface FleetOptimizeResult {
  original_route: FleetRouteStop[];
  optimized_route: FleetRouteStop[];
  priority_explanation: string[];
  transport_mode: string;
  metrics: {
    original_distance_km: number;
    optimized_distance_km: number;
    distance_saved_km: number;
    original_time_min: number;
    optimized_time_min: number;
    time_saved_min: number;
    improvement_pct: number;
    speed_kmh: number;
    elapsed_ms: number;
  };
}

function transportSpeedKmh(mode: string): number {
  if (mode === "walking") return 5;
  if (mode === "service_vehicle") return 30;
  return 40; // car (default)
}

export function optimizeFleetRoute(
  start: Coord,
  destinations: FleetWaypoint[],
  transportMode = "car",
  populationSize = 100,
  generations = 200,
): FleetOptimizeResult {
  const tStart = Date.now();
  const n = destinations.length;
  const destCoords: Coord[] = destinations.map((d) => [d.lat, d.lon]);
  const priorities = destinations.map((d) =>
    Math.min(5, Math.max(1, Math.round(d.priority ?? 3))),
  );
  const speed = transportSpeedKmh(transportMode);

  function buildStops(route: Route): FleetRouteStop[] {
    return route.map((origIdx, pos) => {
      const coord = destCoords[origIdx]!;
      const nextCoord =
        pos < route.length - 1 ? destCoords[route[pos + 1]!]! : null;
      return {
        order: pos + 1,
        lat: coord[0],
        lon: coord[1],
        label: destinations[origIdx]?.label ?? `Stop ${origIdx + 1}`,
        original_index: origIdx,
        distance_to_next_km: nextCoord ? round(haversine(coord, nextCoord), 4) : 0,
      };
    });
  }

  const originalRoute: Route = Array.from({ length: n }, (_, i) => i);
  const originalDist = openPathDistance(start, originalRoute, destCoords);

  if (n <= 1) {
    const stops = buildStops(originalRoute);
    const t = round((originalDist / speed) * 60, 1);
    return {
      original_route: stops,
      optimized_route: stops,
      priority_explanation: [],
      transport_mode: transportMode,
      metrics: {
        original_distance_km: round(originalDist, 4),
        optimized_distance_km: round(originalDist, 4),
        distance_saved_km: 0,
        original_time_min: t,
        optimized_time_min: t,
        time_saved_min: 0,
        improvement_pct: 0,
        speed_kmh: speed,
        elapsed_ms: 0,
      },
    };
  }

  const actualGens = Math.min(generations, Math.max(50, n * 20));
  const actualPop = Math.min(populationSize, Math.max(20, n * 10));

  const fitness = (r: Route) =>
    openPathFitness(start, r, destCoords, priorities);

  let population: Route[] = [originalRoute.slice()];
  while (population.length < actualPop) {
    population.push(randomRoute(n));
  }

  let bestRoute = minByFn(population, fitness);
  let bestFit = fitness(bestRoute);

  for (let gen = 0; gen < actualGens; gen++) {
    const newPop: Route[] = [bestRoute.slice()];
    while (newPop.length < actualPop) {
      const p1 = tournamentSelectFn(population, fitness, 5);
      const p2 = tournamentSelectFn(population, fitness, 5);
      let child = orderedCrossover(p1, p2);
      child = mutate(child, 0.02);
      newPop.push(child);
    }
    population = newPop;
    const candidate = minByFn(population, fitness);
    const candidateFit = fitness(candidate);
    if (candidateFit < bestFit) {
      bestFit = candidateFit;
      bestRoute = candidate.slice();
    }
  }

  const optimizedDist = openPathDistance(start, bestRoute, destCoords);
  const saved = Math.max(0, originalDist - optimizedDist);
  const improvement = originalDist > 0 ? (saved / originalDist) * 100 : 0;

  // Collect priority explanations: high-priority stops that appear earlier
  // in optimized route than their original position
  const explanations: string[] = [];
  for (let pos = 0; pos < bestRoute.length; pos++) {
    const origIdx = bestRoute[pos]!;
    const p = priorities[origIdx] ?? 1;
    if (p >= 4 && pos < origIdx) {
      const label = destinations[origIdx]?.label ?? `Stop ${origIdx + 1}`;
      explanations.push(label);
    }
  }

  return {
    original_route: buildStops(originalRoute),
    optimized_route: buildStops(bestRoute),
    priority_explanation: explanations,
    transport_mode: transportMode,
    metrics: {
      original_distance_km: round(originalDist, 4),
      optimized_distance_km: round(optimizedDist, 4),
      distance_saved_km: round(saved, 4),
      original_time_min: round((originalDist / speed) * 60, 1),
      optimized_time_min: round((optimizedDist / speed) * 60, 1),
      time_saved_min: round((saved / speed) * 60, 1),
      improvement_pct: round(improvement, 2),
      speed_kmh: speed,
      elapsed_ms: Date.now() - tStart,
    },
  };
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
