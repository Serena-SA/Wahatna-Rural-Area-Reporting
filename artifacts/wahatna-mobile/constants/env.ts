// env.ts — single source of truth for the backend base URL.
//
// Resolution order (first match wins):
//   1. EXPO_PUBLIC_API_URL — explicit full origin, e.g. "http://192.168.22.228:8080".
//      Use this to point a physical device (Expo Go) at the dev machine's LAN IP,
//      since the local API runs over plain http with no domain/TLS.
//   2. Web with no explicit URL — same origin that served the page
//      (window.location.origin). This lets a single public tunnel serve both the
//      web app and the API behind one domain without baking the URL at build time.
//   3. EXPO_PUBLIC_DOMAIN  — hosted deployment; served over https.
//   4. http://localhost:8080 — native / same-machine fallback.
//
// Behaviour is unchanged for native and for explicit-URL builds; only web with no
// explicit URL now prefers same-origin (previously it fell back to localhost).

import { Platform } from "react-native";

export function apiOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location?.origin
  ) {
    return window.location.origin;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (domain) return `https://${domain}`;
  return "http://localhost:8080";
}

/** Origin with the `/api` prefix that the backend mounts all routes under. */
export function apiBase(): string {
  return `${apiOrigin()}/api`;
}
