import { apiBase } from "@/constants/env";

const getBaseUrl = () => apiBase();

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const contentType = (options.headers as Record<string, string> | undefined)?.[
    "Content-Type"
  ];
  if (contentType !== "multipart/form-data" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });
}

export async function apiGet<T>(path: string, token?: string | null): Promise<T> {
  const res = await apiFetch(path, { method: "GET" }, token);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string | null
): Promise<T> {
  const res = await apiFetch(
    path,
    { method: "POST", body: JSON.stringify(body) },
    token
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface GeoResult {
  label: string;
  address: string;
  lat: number;
  lon: number;
}

interface NominatimItem {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
}

/**
 * Geocode a place name into coordinates using OpenStreetMap Nominatim.
 * Biased to the UAE so field workers can search local landmarks and
 * addresses instead of typing raw latitude/longitude.
 */
export async function geocode(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2` +
    `&limit=6&addressdetails=0&countrycodes=ae&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
  const data = (await res.json()) as NominatimItem[];
  return data
    .map((d) => {
      const lat = parseFloat(d.lat);
      const lon = parseFloat(d.lon);
      const parts = d.display_name.split(",").map((s) => s.trim());
      return {
        label: d.name || parts[0] || d.display_name,
        address: parts.slice(0, 3).join(", "),
        lat,
        lon,
      };
    })
    .filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lon));
}
