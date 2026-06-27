# Wahatna — Session Handout

_Generated 2026-06-27. Summarises everything done in this working session and the app's current runnable state on this Windows machine._

---

## 1. TL;DR — how to run it right now

Two terminals from the repo root
(`C:\Users\ftm3a\Downloads\Wahatna-Rural-Reporting\Wahatna-Rural-Reporting`):

**Terminal 1 — API server (port 8080)**
```powershell
cd artifacts\api-server
node --env-file=.env --enable-source-maps ./dist/index.mjs
```
(If you changed API source: `pnpm --filter @workspace/api-server run build` first.)

**Terminal 2 — Web app (port 8081)**
```powershell
pnpm --filter @workspace/wahatna-mobile run web:local
```

Then open **http://localhost:8081**.

- **Only one API may listen on 8080 at a time.** `EADDRINUSE` just means one is already running — use it, or stop it (`npx kill-port 8080`) and start yours.
- `Cannot GET /` at `http://localhost:8080/` is **normal** — the API only serves routes under `/api`.

### Login (seeded accounts — all share the password `wahatna2024`)
| Username | Role |
|---|---|
| `supervisor` | supervisor |
| `fatima.khalid` | supervisor |
| `ahmed.al.rashidi` | user (worker) |
| `demo` | user (worker) |

> Self-registration always creates a **worker** (`user`) — supervisors exist only via the seed. Workers file reports; supervisors receive/manage them.

---

## 2. Environment & prerequisites (set up this session)

| Tool | State |
|---|---|
| Node.js | v24.15.0 (already installed) |
| pnpm | 11.9.0 — installed via `npm install -g pnpm` (corepack `enable` failed with EPERM on `C:\Program Files\nodejs`) |
| PostgreSQL | **17**, installed via winget. Service `postgresql-x64-17` auto-starts on boot. Superuser `postgres` / password `postgres`, port `5432`. App DB: **`wahatna`** |
| Dependencies | `pnpm install` at repo root (1137 packages) |

### Environment file — `artifacts/api-server/.env` (gitignored)
```
PORT=8080
JWT_SECRET=<generated 64-char hex>
DATABASE_URL=postgres://postgres:postgres@localhost:5432/wahatna
ORS_API_KEY=<your OpenRouteService key>
```
A safe template is committed at `artifacts/api-server/.env.example`.

### Windows-compatibility fixes (the repo was Linux/Replit-only)
- **`pnpm-workspace.yaml`** — its `overrides` stripped *every* non-Linux native binary. Restored the **win32-x64** builds for `esbuild`, `rollup`, `lightningcss`, `@tailwindcss/oxide`; removed a malformed `allowBuilds:` stub pnpm 11 appended. Without this, nothing builds on Windows.
- **`lib/db/drizzle.config.ts`** — schema path normalised to forward slashes (`.replace(/\\/g, "/")`); drizzle-kit's globbing breaks on Windows backslashes ("No schema files found").
- **API port 8080** (not 5000) — matches the mobile app's local fallback `http://localhost:8080/api`.
- Added Expo scripts **`web:local`** (`expo start --web`) and **`start:local`** (`expo start`); the original `dev` script is Replit-only (bash env-prefixes + `REPLIT_*` vars).

> Gotcha: the committed `lib/db/dist` `.d.ts` can be stale → bogus "Property does not exist on fleet_waypoints" errors in the api-server typecheck. Run `pnpm run typecheck:libs` first to regenerate, then it passes. (esbuild `build` doesn't typecheck, so it never blocks running.)

---

## 3. Features built this session

### 3.1 Run locally (decoupled from Replit)
The app now runs entirely on Windows via the web build; API + Postgres + Drizzle + JWT auth all verified working locally.

### 3.2 Fleet — Start Location options
Start point can now be set four ways via a selector: **GPS · Search · Pin on map · Manual**. Reuses the existing geocode search and the map's (previously unused) pin-drop. Auto-switches to Search when GPS is denied.

### 3.3 Fleet — real road routing (OpenRouteService)
- New `artifacts/api-server/src/lib/routing.ts`. Transport mode → ORS profile: **car → `driving-car`, service vehicle → `driving-hgv` (truck), walking → `foot-walking`**.
- The map draws the **actual road geometry**; distance/time are real and mode-specific.
- **Graceful fallback**: no key / offline / unroutable → straight-line estimate (and the label flips to "Straight-line estimate").
- **`radiuses: -1`** so ORS snaps far-from-road rural/desert points (fixes the common "no routable point within 350 m" failure).
- **Dashed line** when a leg has no road route for the chosen mode (e.g. a desert point with no drivable road — walking still routes, car/truck legitimately can't).

### 3.4 Fleet — add reports as waypoints
Supervisors can add **unresolved** reports (pending / under-review / assigned / late) as waypoints; each waypoint's priority is derived from the report's severity.

### 3.5 Fleet tab visibility
The **Fleet tab is hidden for workers** — visible only to supervisors/admins.

### 3.6 Reports tab (rebuilt)
The supervisor "Reports" tab was a dead placeholder (infinite spinner). Rebuilt as a full report list: status/severity filters, viewable cards (image, badges, reporter, location, date), **per-report delete**, and a **"Clear demo data"** button. Uses web-safe inline confirmations (not `Alert`).

### 3.7 Delete reports ("remove dummies")
- **Per-report delete** + **bulk "Clear demo data"**, both **permanent (hard delete)**, FK-safe (removes dependent `reports` rows first).
- Endpoints: `DELETE /api/supervisor/reports/:id`, `POST /api/supervisor/reports/clear-demo`.
- "Demo" = seeded rows, identified by **non-null `confidence`** (real reports always leave confidence null because the CV classifier is stubbed). Verified: clear-demo removed the seeds and **kept the real user report**.

### 3.8 Heat compliance — surfacing (Al Qua'a specific)
- **Home banner (always on)**: live **Open-Meteo** temperature at Al Qua'a (23.83°N, 55.73°E — free, no key), MOHRE midday-ban status (active / "Ban starts in …" / none), the **Tropic of Cancer** line, and coordinates.
- **Report screen**: choosing `heat_stress` shows a red **"UAE midday ban active — outdoor dispatch on hold. Emergency services still available."** during the ban window, and an orange "Heat emergencies can be reported any time" note otherwise.
- Client util `artifacts/wahatna-mobile/constants/heat.ts` mirrors the server ban rule + fetches the live temp.

### 3.9 Day/night desert background (Home)
Stylized SVG backdrop behind the Home screen — sunny dunes + ghaf-tree silhouettes by day, starry sky + moon at night — switching by device time, with a dark scrim for text readability.

### 3.10 Supervisor resource dispatch (water/food)
- New incident columns `resources_dispatched_at` / `resources_dispatched_by` (schema pushed).
- Endpoint `PATCH /api/supervisor/reports/:id/dispatch`.
- On the **Supervisor** tab, expanding a report shows **"Dispatch water & food"**; tapping records who/when and flips to **"Water & food dispatched · <time>"**.

### 3.11 Internationalisation
Every new string was added in all four languages (English, Arabic, Urdu, Hindi) and is RTL-aware.

---

## 4. New / changed files

**Added**
- `artifacts/api-server/src/lib/routing.ts` — ORS road routing
- `artifacts/api-server/.env.example` — env template
- `artifacts/wahatna-mobile/constants/heat.ts` — client ban logic + Open-Meteo
- `artifacts/wahatna-mobile/components/HeatBanner.tsx`
- `artifacts/wahatna-mobile/components/DesertBackground.tsx`
- `docs/SESSION_HANDOUT.md` — this file

**Changed (highlights)**
- `pnpm-workspace.yaml`, `lib/db/drizzle.config.ts` — Windows compat
- `lib/db/src/schema/wahatna.ts` — dispatch columns
- `artifacts/api-server/src/lib/serialize.ts` — exposes `resources_dispatched_at`
- `artifacts/api-server/src/routes/fleet.ts` — road routing wired in
- `artifacts/api-server/src/routes/supervisor.ts` — delete + clear-demo + dispatch endpoints
- `artifacts/wahatna-mobile/app/(tabs)/_layout.tsx` — Fleet hidden for workers
- `artifacts/wahatna-mobile/app/(tabs)/fleet.tsx` — start-location options, add-from-reports, dashed route
- `artifacts/wahatna-mobile/app/(tabs)/reports.tsx` — full rebuild
- `artifacts/wahatna-mobile/app/(tabs)/supervisor.tsx` — dispatch button
- `artifacts/wahatna-mobile/app/(tabs)/index.tsx` — heat banner + desert background
- `artifacts/wahatna-mobile/app/(tabs)/report.tsx` — heat warning
- `artifacts/wahatna-mobile/components/RouteMap*.tsx`, `constants/mapHtml.ts` — dashed route support
- `artifacts/wahatna-mobile/constants/i18n.ts` — new strings ×4 languages

---

## 5. Git status

- **Remote:** https://github.com/Serena-SA/Wahatna-Rural-Area-Reporting
- All commits authored as **you** (`f29tm <ftm3az@gmail.com>`) — **no AI/Claude attribution**.
- Secrets never committed: `.env` and the runtime `uploads/` are gitignored; only `.env.example` is tracked.

**`main`** currently contains: the Windows setup fixes, Fleet Start-Location options, and the initial ORS routing (pushed earlier via an `-s ours` merge that preserved the repo's prior history). The `windows-local` branch holds the same snapshot.

**Not yet committed/pushed (in the local working tree, held per your "wait until all done"):**
ORS `radiuses` fix + dashed fallback · Reports-tab rebuild · delete (per-report + clear-demo) · Fleet add-from-reports · Fleet-tab hidden for workers · heat surfacing · desert background · resource dispatch · DB schema columns · i18n additions.
→ Say the word and I'll commit + push this batch to `main` (as you, no Claude attribution).

---

## 6. Current running state

- **API** on `http://localhost:8080` (with your ORS key) — running from this session.
- **Web app** on `http://localhost:8081` — running from this session.
- **Database** `wahatna` on local Postgres; schema is up to date (includes dispatch columns). Demo data is seeded on API startup when the incident count is low.
- These processes were started during the session; if they're gone, restart with the commands in §1.

---

## 7. Known limitations & open items

- **Notifications** (20-min-to-ban warning, supervisor push) — **not built** (you chose to skip). On-device local notifications would be native-app only; real push to supervisors needs server-side Expo Push (tokens are stored but unused).
- **"Worker notified" of dispatch** — the dispatch is recorded and returned in report data, but **not yet surfaced on the worker's My Reports screen**. (Easy add if you want it.)
- **Some rural points aren't car-routable** — if OSM has no drivable road to a point, car/truck show a dashed straight-line estimate; walking usually routes. This is map-data reality, handled gracefully.
- **Fleet visiting order** still uses straight-line (Haversine) distance for the genetic-algorithm ordering; the *drawn route and all distances/times* are real roads. A road distance-matrix for ordering is a possible enhancement.
- **CV classifier** remains stubbed (`vision.ts`) — `confidence` is always null for real reports (which is what powers the clear-demo discriminator).
- Mobile **native** (iOS/Android via Expo Go / EAS) wasn't run this session — only the **web** build. The `dev` script needs adapting for native off-Replit (LAN IP for the API, etc.).

---

## 8. Verification done this session
All four workspace packages typecheck clean. End-to-end checks passed: local login/register, supervisor login, road routing (car/walking/truck, incl. the rural radius fix + regression on normal routes), per-report delete, clear-demo (kept the real report), resource dispatch persistence, live Open-Meteo temperature, and the web bundle compiling with every new string/component.
