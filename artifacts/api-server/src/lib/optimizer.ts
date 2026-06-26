export type Coord = [number, number]; // [lat, lon]
export type Route = number[]; // ordered indices into coords list

const EARTH_RADIUS_KM = 6371.0;

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

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
