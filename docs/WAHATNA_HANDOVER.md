# Wahatna — Project Handover Document

> **Wahatna** (واحتنا, "Our Oasis") is a rural municipal safety and incident-reporting platform built for the Al Qua'a region, UAE. Field workers, residents, and supervisors use it to report hazards, track incidents, and dispatch response vehicles — all in Arabic, English, Urdu, and Hindi.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack & Versions](#3-tech-stack--versions)
4. [Repository Structure](#4-repository-structure)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Mobile App Screens](#7-mobile-app-screens)
8. [Key Algorithms & Modules](#8-key-algorithms--modules)
9. [Environment Variables & Secrets](#9-environment-variables--secrets)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Internationalisation (i18n)](#11-internationalisation-i18n)
12. [Offline Support](#12-offline-support)
13. [Development Setup](#13-development-setup)
14. [Key File Index](#14-key-file-index)
15. [Known Limitations & Future Work](#15-known-limitations--future-work)
16. [Emergency Contacts & Protocols Embedded in App](#16-emergency-contacts--protocols-embedded-in-app)

---

## 1. Project Overview

| Attribute | Value |
|-----------|-------|
| **App name** | Wahatna (واحتنا) |
| **Region** | Al Qua'a, Abu Dhabi, UAE |
| **Platform** | iOS + Android mobile app (Expo/React Native) + REST API |
| **Languages** | English · Arabic (RTL) · Urdu (RTL) · Hindi |
| **GitHub** | `Serena-SA/Wahatna-Rural-Area-Reporting` |
| **Replit project** | Wahatna monorepo (pnpm workspaces) |

### User Roles

| Role | Access |
|------|--------|
| `user` | Submit hazard reports, view own reports, use fleet planner |
| `supervisor` | All user access + dashboard, status management, notes |
| `admin` | All supervisor access (future expansion) |

### Core Workflows

```
Field worker spots hazard
        │
        ▼
Opens "Report Hazard" screen (GPS auto-captured)
        │
        ▼
Selects category + adds photo + optional text
        │
        ▼
App calls POST /report ──► API classifies hazard (vision.ts)
                        ──► Agent calculates risk score + SLA (agent.ts)
                        ──► Incident saved to DB
                        │
                        ▼
Supervisor sees incident on dashboard (GET /supervisor/dashboard)
        │
        ▼
Supervisor updates status / adds notes / assigns team
        │
        ▼
Dispatcher uses Fleet screen to plan optimised response route
        │
        ▼
Incident resolved → marked "completed"
```

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Replit Monorepo                        │
│                   (pnpm workspaces)                         │
│                                                             │
│  ┌──────────────────┐      ┌──────────────────────────┐    │
│  │  wahatna-mobile  │      │       api-server          │    │
│  │  (Expo/RN)       │─────►│  (Express 5 + TypeScript) │    │
│  │  Port: $PORT     │ HTTP │  Port: $PORT              │    │
│  └──────────────────┘      └────────────┬─────────────┘    │
│                                         │                   │
│                              ┌──────────▼──────────┐       │
│                              │    lib/db (Drizzle)  │       │
│                              │    PostgreSQL         │       │
│                              └─────────────────────-┘       │
└─────────────────────────────────────────────────────────────┘

External services:
  • Nominatim (OpenStreetMap) — geocoding / reverse geocoding
  • Device GPS — location capture
  • Expo Push Notifications — supervisor alerts (push token stored)
```

### Data Flow — Hazard Report

```
Mobile              API Server              Database
  │                     │                      │
  │ POST /report         │                      │
  │ (multipart/form)    │                      │
  │────────────────────►│                      │
  │                     │ analyzeCategory()    │
  │                     │ (vision.ts)          │
  │                     │                      │
  │                     │ assessIncident()     │
  │                     │ (agent.ts + BM25)   │
  │                     │                      │
  │                     │ INSERT incidents     │
  │                     │─────────────────────►│
  │                     │                      │
  │                     │ INSERT reports       │
  │                     │─────────────────────►│
  │◄────────────────────│                      │
  │ { incident_id,      │                      │
  │   severity, SLA }   │                      │
```

---

## 3. Tech Stack & Versions

### Backend (`artifacts/api-server`)

| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | ≥ 20 | Runtime |
| TypeScript | 5.x | Type safety |
| Express | ^5.2.1 | HTTP framework |
| Drizzle ORM | catalog | DB queries + migrations |
| `jsonwebtoken` | ^9.0.3 | JWT auth tokens |
| `bcryptjs` | ^3.0.3 | Password hashing |
| `multer` | ^2.2.0 | Multipart image uploads |
| `pino` / `pino-http` | ^9.x / ^10.x | Structured logging |
| `cors` | ^2.8.6 | CORS headers |
| esbuild | 0.27.3 | Build bundler |

### Database (`lib/db`)

| Package | Version | Purpose |
|---------|---------|---------|
| PostgreSQL | 16 (Replit managed) | Primary datastore |
| Drizzle ORM | catalog | Schema definition + query builder |
| `drizzle-kit` | ^0.31.10 | Schema push / migrations |
| `pg` | ^8.22.0 | Node postgres driver |
| `zod` | catalog | Schema validation |

### Mobile (`artifacts/wahatna-mobile`)

| Package | Version | Purpose |
|---------|---------|---------|
| Expo | ~54.0.27 | RN framework + tooling |
| React Native | 0.81.5 | UI runtime |
| Expo Router | ~6.0.17 | File-based navigation |
| React Native Reanimated | ~4.1.1 | Animations |
| Expo Location | ~19.0.8 | GPS |
| Expo Image Picker | ~17.0.9 | Camera / gallery |
| Expo Notifications | ^0.32.17 | Push notifications |
| Expo Haptics | ~15.0.8 | Vibration feedback |
| AsyncStorage | 2.2.0 | Offline queue persistence |
| React Native WebView | 13.15.0 | Leaflet map rendering |
| Expo Linear Gradient | ~15.0.8 | UI gradients |
| React Native Safe Area | ~5.6.0 | Notch / inset handling |

---

## 4. Repository Structure

```
wahatna/                          ← Replit monorepo root
├── artifacts/
│   ├── api-server/               ← Express REST API
│   │   ├── src/
│   │   │   ├── app.ts            ← Express app factory + middleware
│   │   │   ├── index.ts          ← Entry point (binds port)
│   │   │   ├── lib/
│   │   │   │   ├── agent.ts      ← Risk assessment + BM25 knowledge base
│   │   │   │   ├── auth.ts       ← JWT middleware (requireAuth, requireSupervisor)
│   │   │   │   ├── heat.ts       ← MOHRE heat ban checker
│   │   │   │   ├── logger.ts     ← Pino logger configuration
│   │   │   │   ├── optimizer.ts  ← Genetic algorithm fleet router
│   │   │   │   ├── seed.ts       ← Database seeding script
│   │   │   │   ├── serialize.ts  ← Incident → JSON serialiser
│   │   │   │   └── vision.ts     ← Hazard classifier (stubbed CV)
│   │   │   └── routes/
│   │   │       ├── auth.ts       ← /auth/register, /auth/login, /auth/me
│   │   │       ├── fleet.ts      ← /fleet/optimize, /fleet/jobs
│   │   │       ├── index.ts      ← Route aggregator
│   │   │       ├── report.ts     ← /report, /reports/my, /reports/:id
│   │   │       ├── supervisor.ts ← /supervisor/dashboard, /supervisor/reports
│   │   │       └── worker.ts     ← /worker/location, /worker/push-token
│   │   ├── build.mjs             ← esbuild bundler script
│   │   └── package.json
│   │
│   └── wahatna-mobile/           ← Expo React Native app
│       ├── app/
│       │   ├── _layout.tsx       ← Root layout + AuthContext provider
│       │   ├── login.tsx         ← Login screen
│       │   ├── register.tsx      ← Registration screen
│       │   └── (tabs)/
│       │       ├── _layout.tsx   ← Tab bar configuration
│       │       ├── index.tsx     ← Home dashboard
│       │       ├── report.tsx    ← Multi-step hazard report flow
│       │       ├── my-reports.tsx← Reporter's incident history
│       │       ├── reports.tsx   ← Supervisor incident list
│       │       ├── supervisor.tsx← Supervisor management dashboard
│       │       └── fleet.tsx     ← Fleet route optimizer
│       ├── components/
│       │   ├── GlassCard.tsx     ← Glassmorphism card container
│       │   ├── OfflineBanner.tsx ← Offline status indicator
│       │   ├── RouteMap.tsx      ← Leaflet map (native)
│       │   ├── RouteMap.web.tsx  ← Leaflet map (web fallback)
│       │   └── SeverityBadge.tsx ← Coloured severity indicator
│       ├── constants/
│       │   ├── api.ts            ← apiPost/apiGet helpers + geocode()
│       │   ├── colors.ts         ← Oasis-themed colour palette
│       │   ├── i18n.ts           ← All translation strings (EN/AR/UR/HI)
│       │   └── mapHtml.ts        ← Leaflet HTML template for WebView
│       ├── context/
│       │   ├── AuthContext.tsx   ← JWT token storage + user state
│       │   ├── LanguageContext.tsx← t() translation hook + RTL flag
│       │   └── OfflineQueueContext.tsx ← Offline report queue
│       └── hooks/
│           └── useColors.ts      ← Theme-aware colour hook
│
├── lib/
│   ├── db/                       ← Shared database package
│   │   ├── src/
│   │   │   ├── index.ts          ← Drizzle client export
│   │   │   └── schema/
│   │   │       └── wahatna.ts    ← All table definitions + types
│   │   └── drizzle.config.ts     ← DB connection for drizzle-kit
│   └── api-spec/                 ← OpenAPI spec (future use)
│
├── docs/                         ← This documentation folder
│   ├── WAHATNA_HANDOVER.md       ← This file
│   └── WAHATNA_HANDOVER.docx     ← Word version
│
├── scripts/
│   └── post-merge.sh             ← Runs `db push` after each task merge
├── package.json                  ← Root pnpm workspace config
└── pnpm-workspace.yaml           ← Workspace package paths
```

---

## 5. Database Schema

All tables are in `lib/db/src/schema/wahatna.ts`. The database is a Replit-managed **PostgreSQL 16** instance, accessed via `DATABASE_URL`.

### `users` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Auto-increment |
| `username` | text UNIQUE NOT NULL | Login name |
| `email` | text UNIQUE NOT NULL | |
| `password_hash` | text NOT NULL | bcrypt hash (rounds=10) |
| `full_name` | text | Display name |
| `role` | text DEFAULT `'user'` | `'user'` \| `'supervisor'` \| `'admin'` |
| `employee_id` | text | Municipal employee ID |
| `shift_active` | boolean DEFAULT false | Whether worker is on shift |
| `hazard_score` | integer DEFAULT 0 | Gamification points |
| `streak_days` | integer DEFAULT 0 | Consecutive reporting days |
| `total_reports` | integer DEFAULT 0 | Lifetime report count |
| `last_known_lat` | double | Last GPS latitude |
| `last_known_lon` | double | Last GPS longitude |
| `push_token` | text | Expo push notification token |
| `preferred_language` | text DEFAULT `'en'` | `'en'` \| `'ar'` \| `'ur'` \| `'hi'` |
| `created_at` | timestamp | Auto |
| `updated_at` | timestamp | Auto |

### `incidents` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | integer FK → users | Reporter |
| `lat` | double NOT NULL | WGS84 latitude |
| `lon` | double NOT NULL | WGS84 longitude |
| `location_name` | text | Reverse-geocoded address |
| `threat_class` | text NOT NULL | Internal class key (e.g. `heat_stress`) |
| `threat_label` | text | Human-readable label |
| `confidence` | double | Always null (CV stubbed) |
| `severity` | integer DEFAULT 3 | 1 (Low) – 5 (Critical) |
| `severity_label` | text | `'low'` \| `'moderate'` \| `'elevated'` \| `'high'` \| `'critical'` |
| `secondary_threats` | text | JSON array string |
| `heat_index_estimate` | double | °C estimate (heat_stress only) |
| `risk_level` | text | Risk level label |
| `risk_score` | integer | 1–5 |
| `assessment_summary` | text | Auto-generated summary |
| `recommended_protocol` | text | Action steps |
| `regulatory_reference` | text | UAE law / authority reference |
| `dialect_note` | text | Arabic dialect term detection |
| `report_text` | text | Free-text note from reporter |
| `image_path` | text | Server path to uploaded image |
| `image_filename` | text | Original filename |
| `status` | text DEFAULT `'pending_review'` | See status lifecycle below |
| `due_at` | timestamp | SLA deadline |
| `escalation_required` | boolean | Set true when overdue |
| `escalated_at` | timestamp | When escalation was triggered |
| `escalation_level` | integer | 0 = none |
| `supervisor_notes` | text | Supervisor internal notes |
| `rejection_reason` | text | Required when status = `rejected` |
| `status_history` | text | JSON: `[{status, timestamp, note}]` |
| `location_source` | text | `'gps'` \| `'pin'` \| `'address'` |
| `address_details` | text | Free-text address supplement |
| `phone_primary` | text | Reporter contact |
| `phone_secondary` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Incident Status Lifecycle:**

```
pending_review → under_review → assigned → completed
                             └──────────► rejected
                             └─ (overdue)→ late
```

**SLA Rules (from `agent.ts`):**

| Severity | SLA |
|----------|-----|
| 5 (Critical) | 6 hours |
| 4 (High) | 24 hours |
| 3 (Elevated) | 72 hours |
| 1–2 (Low/Moderate) | 144 hours (6 days) |

### `fleet_waypoints` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `job_id` | text | 8-char UUID prefix — groups stops in one route job |
| `user_id` | integer FK → users | Dispatcher who ran optimization |
| `transport_mode` | text | `'walking'` \| `'car'` \| `'service_vehicle'` |
| `total_distance_km` | double | Total optimized route distance |
| `lat` | double NOT NULL | Stop latitude |
| `lon` | double NOT NULL | Stop longitude |
| `label` | text | Stop name / description |
| `optimized_order` | integer | Position in optimized route (1-based) |
| `distance_to_next_km` | double | Leg distance to next stop |
| `created_at` | timestamp | |

### `reports` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | integer FK → users NOT NULL | |
| `incident_id` | integer FK → incidents | Links to incident record |
| `lat` | double NOT NULL | |
| `lon` | double NOT NULL | |
| `report_text` | text | |
| `image_filename` | text | |
| `score_awarded` | integer DEFAULT 0 | Gamification points earned |
| `created_at` | timestamp | |

---

## 6. API Reference

**Base URL:** `https://<REPLIT_DEV_DOMAIN>/api-server/api` (development)  
**Auth header:** `Authorization: Bearer <jwt_token>`  
**Content-Type:** `application/json` (except file uploads: `multipart/form-data`)

---

### Auth Routes

#### `POST /auth/register`
Create a new user account.

**Request body:**
```json
{
  "username": "ali_worker",
  "email": "ali@example.com",
  "password": "SecurePass123",
  "fullName": "Ali Hassan",
  "role": "user",
  "employeeId": "EMP-001",
  "preferredLanguage": "ar"
}
```

**Response 201:**
```json
{
  "token": "<jwt>",
  "user": { "id": 1, "username": "ali_worker", "role": "user", ... }
}
```

---

#### `POST /auth/login`
Authenticate and receive JWT.

**Request body:**
```json
{ "username": "ali_worker", "password": "SecurePass123" }
```

**Response 200:**
```json
{ "token": "<jwt>", "user": { ... } }
```

---

#### `GET /auth/me`
🔒 Requires auth. Returns current user profile.

---

### Report Routes

#### `POST /report`
🔒 Submit a new hazard report. `multipart/form-data`.

**Form fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `lat` | number | ✅ | WGS84 |
| `lon` | number | ✅ | WGS84 |
| `category` | string | ✅ | See hazard categories below |
| `report_text` | string | | Free text |
| `location_name` | string | | Address hint |
| `location_source` | string | | `gps` \| `pin` \| `address` |
| `phone_primary` | string | | |
| `image` | file | | JPEG/PNG, max 10 MB |

**Hazard categories:** `heat_stress`, `road_damage`, `waste`, `flood`, `fire`, `electrical`, `structural`, `other`

**Response 201:**
```json
{
  "incident_id": 42,
  "threat_class": "fire_hazard",
  "severity": 4,
  "severity_label": "High",
  "risk_level": "High",
  "due_at": "2026-06-28T10:00:00.000Z",
  "assessment_summary": "A fire hazard was reported at ...",
  "recommended_protocol": "Evacuate immediately and call Civil Defence (997).",
  "regulatory_reference": "UAE Civil Defence Fire & Life Safety Code",
  "score_awarded": 25
}
```

---

#### `GET /reports/my`
🔒 Returns paginated list of the authenticated user's own reports.

**Query params:** `?page=1&limit=20`

---

#### `GET /reports/:id`
🔒 Returns full detail of a single incident the user reported.

---

### Supervisor Routes

> All supervisor routes require role `supervisor` or `admin`.

#### `GET /supervisor/dashboard`
🔒🔑 Returns stats and active incidents. Automatically marks overdue incidents as `late`.

**Response:**
```json
{
  "counts": { "pending_review": 5, "under_review": 2, "late": 1 },
  "critical_count": 0,
  "late_count": 1,
  "active_incidents": [ { ... incident objects ... } ]
}
```

---

#### `GET /supervisor/reports`
🔒🔑 Full filterable incident list.

**Query params:** `?status=pending_review&severity=4&page=1&limit=20`

---

#### `PATCH /supervisor/reports/:id/status`
🔒🔑 Update incident status.

**Request body:**
```json
{
  "status": "rejected",
  "rejection_reason": "Duplicate report — see incident #38"
}
```
`rejection_reason` is required when `status = "rejected"`.

---

#### `PATCH /supervisor/reports/:id/notes`
🔒🔑 Add or update supervisor internal notes.

**Request body:**
```json
{ "notes": "Assigned to Team B. Vehicle dispatched 14:30." }
```

---

### Fleet Routes

#### `POST /fleet/optimize`
🔒 Run GA route optimization.

**Request body:**
```json
{
  "start": { "lat": 24.1234, "lon": 55.5678 },
  "waypoints": [
    { "lat": 24.13, "lon": 55.57, "label": "School", "priority": 5 },
    { "lat": 24.14, "lon": 55.58, "label": "Market", "priority": 2 }
  ],
  "transport_mode": "service_vehicle"
}
```

**Priority values:** 1 = Low, 2 = Medium, 4 = High, 5 = Critical

**Response:**
```json
{
  "job_id": "a3f2b1c4",
  "transport_mode": "service_vehicle",
  "original_route": {
    "stops": [ { "order": 1, "label": "School", "lat": 24.13, "lon": 55.57, "distance_to_next_km": 1.2, "priority_note": "" } ],
    "total_distance_km": 3.5,
    "estimated_time_min": 7.0
  },
  "optimized_route": {
    "stops": [ { "order": 1, "label": "School", "priority_note": "Moved to position 1 (was 2) — critical priority", ... } ],
    "total_distance_km": 2.9,
    "estimated_time_min": 5.8
  },
  "priority_explanation": ["School: Moved to position 1 (was 2) — critical priority"],
  "metrics": {
    "distance_saved_km": 0.6,
    "time_saved_min": 1.2,
    "improvement_pct": 17.1,
    "speed_kmh": 30,
    "elapsed_ms": 42
  }
}
```

---

#### `GET /fleet/jobs`
🔒 List the last 20 route jobs for the authenticated user.

**Response:**
```json
{
  "jobs": [
    { "jobId": "a3f2b1c4", "transportMode": "service_vehicle", "totalDistanceKm": 2.9, "stopCount": 2, "createdAt": "..." }
  ]
}
```

---

#### `GET /fleet/jobs/:jobId`
🔒 Load full stop list for a specific past job (scoped to requesting user — cross-user access returns 404).

---

### Worker Routes

#### `PATCH /worker/location`
🔒 Update the worker's last known GPS position.

**Request body:** `{ "lat": 24.12, "lon": 55.56 }`

---

#### `POST /worker/push-token`
🔒 Register or update Expo push notification token.

**Request body:** `{ "token": "ExponentPushToken[...]" }`

---

## 7. Mobile App Screens

### Auth Screens

| Screen | File | Notes |
|--------|------|-------|
| Login | `app/login.tsx` | Username + password, JWT stored in AuthContext |
| Register | `app/register.tsx` | Role selection, language preference |

### Tab Screens

| Tab | File | Access | Description |
|-----|------|--------|-------------|
| Home | `(tabs)/index.tsx` | All | Greeting, MOHRE heat-ban banner, safety stats, quick actions |
| Report | `(tabs)/report.tsx` | All | 3-step hazard report: location → category+photo → confirmation |
| My Reports | `(tabs)/my-reports.tsx` | All | Paginated personal incident history |
| Reports | `(tabs)/reports.tsx` | Supervisor | Full incident list with filters |
| Supervisor | `(tabs)/supervisor.tsx` | Supervisor | Dashboard stats, status management, notes |
| Fleet | `(tabs)/fleet.tsx` | All | GPS start detection, transport mode, waypoints, GA optimizer, comparison view, route history |

### Fleet Screen Detail

The Fleet screen (`fleet.tsx`) has the following sections:

1. **Start Location** — GPS auto-detected on mount. If denied, shows OS-specific settings instructions (iOS vs Android) and manual lat/lon inputs.
2. **Transport Mode** — Chips: Walking (5 km/h) | Car (40 km/h) | Service Vehicle (30 km/h). Walking shows a "short distances only" disclaimer.
3. **Destination Waypoints** — Search box (geocodes via Nominatim), add stops, set priority per stop (Low / Medium / High / Critical).
4. **Optimize button** — Sends to `POST /fleet/optimize`, shows savings banner + side-by-side comparison (Original Order vs Optimized Route) with per-stop priority notes.
5. **Route History** — Lists last 20 jobs; tap "View" to replay any job into the waypoints editor.

---

## 8. Key Algorithms & Modules

### 8.1 Hazard Classifier — `vision.ts`

**Status: STUBBED** — no computer-vision model is run.

The classifier maps the category selected by the field worker to a deterministic profile. `confidence` is always `null` to make this explicit.

| Category Input | threat_class | Severity | Key Authority |
|----------------|-------------|----------|---------------|
| `heat_stress` | `heat_stress` | 3 (Elevated) | MOHRE |
| `fire` | `fire_hazard` | 4 (High) | Civil Defence (997) |
| `electrical` | `power_line_hazard` | 4 (High) | DEWA (991) / ADDC |
| `structural` | `structural_risk` | 4 (High) | Civil Defence |
| `flood` | `flood_risk` | 3 (Elevated) | NCM / Civil Defence |
| `road_damage` | `road_hazard` | 2 (Moderate) | RTA |
| `waste` | `waste_hazard` | 2 (Moderate) | Municipality |
| `other` | `general_hazard` | 2 (Moderate) | MOHRE |

**To replace with real CV:** Implement `analyzeCategory()` in `vision.ts` to call an image model (e.g. GPT-4o Vision, a local ONNX model) and return the same `VisionDict` interface. The rest of the pipeline is unchanged.

---

### 8.2 Risk Assessment Agent — `agent.ts`

Fully local — no external API calls.

**Components:**

1. **UAE Knowledge Base** — 11 in-process documents covering MOHRE heat ban, Civil Defence fire protocol, DEWA electrical rules, RTA road hazards, wadi flood response, HAZMAT, dust storm protocol, Emirati dialect hazard terms, heat stress thresholds, waste/sanitation standards, and structural inspection requirements.

2. **BM25 Retrieval** — `retrieveContext(query, topK=3)` scores each knowledge document against the incident's threat class + report text. Returns top-3 most relevant docs.

3. **Dialect Detection** — `detectDialect(reportText)` scans for Emirati/Gulf Arabic terms (e.g. `ta3ban`, `harara`, `suyool`) and returns a note for supervisors.

4. **SLA Calculation** — `calculateDueAt(severity)` returns the response deadline based on severity (see table in §5).

5. **Assessment** — `assessIncident()` combines all the above into a single `AgentAssessment` object attached to every incident.

---

### 8.3 Fleet Route Optimizer — `optimizer.ts`

**Algorithm:** Genetic Algorithm (GA) with priority-weighted fitness function.

**Two separate optimizers exist in this file:**

| Function | Use Case | Route Type |
|----------|----------|------------|
| `optimize()` | Legacy / TSP | Closed cycle (returns to start) |
| `optimizeFleetRoute()` | Fleet dispatch | Open path (start → stops, no return) |

**`optimizeFleetRoute()` details:**

```
Parameters:
  start       — GPS coordinate of the dispatcher's current position
  destinations — Array of stops with {lat, lon, label, priority}
  transportMode — "walking" | "car" | "service_vehicle"
  populationSize — default 100
  generations    — default 200

Distance metric:
  Haversine formula (straight-line, not road distance)
  Note: estimates may be 30–60% shorter than actual road distance
  in UAE desert terrain

Fitness function:
  F(route) = openPathDistance + Σ(priority_i × position_i × 0.3)

  The priority penalty (0.3 km-equivalent per severity point × position)
  forces the GA to visit high-priority stops earlier in the route.

Speed constants:
  walking         = 5 km/h
  service_vehicle = 30 km/h
  car             = 40 km/h (default)

GA operators:
  Selection:  Tournament selection (k=5)
  Crossover:  Ordered crossover (OX)
  Mutation:   Swap mutation (rate=0.02)
  Elitism:    Best route always preserved

Output:
  original_route  — stops in input order + totals
  optimized_route — stops in GA-optimal order + per-stop priority_note
  priority_explanation — list of stops moved earlier due to severity ≥ 4
  metrics — distance_saved_km, time_saved_min, improvement_pct, speed_kmh
```

---

### 8.4 MOHRE Heat Ban — `heat.ts`

Checks whether the current UAE time falls within the MOHRE outdoor work ban period:
- **Dates:** 15 June – 15 September (annually)
- **Hours:** 12:30 – 15:00 UAE local time (UTC+4)
- Displayed as a banner on the Home screen. No external API call — purely date/time logic.

---

### 8.5 Offline Queue — `OfflineQueueContext.tsx`

- Detects network connectivity using `@react-native-community/netinfo`.
- Stores unsent reports in `AsyncStorage` under key `offline_queue`.
- On reconnect, automatically replays queued reports in order.
- **Duplicate protection:** Blocks submission if an identical report (same category + same coordinates within 100m) was submitted within 5 minutes, or if a pending queue item matches.

---

## 9. Environment Variables & Secrets

> Manage these through the Replit Secrets panel — never hardcode values.

| Key | Scope | Required | Description |
|-----|-------|----------|-------------|
| `DATABASE_URL` | Runtime | ✅ | PostgreSQL connection string (managed by Replit) |
| `JWT_SECRET` | Secret | ✅ | HMAC secret for signing JWTs. Use a random 64-char hex string. |
| `GITHUB_PAT` | Secret | For pushes | Personal access token for `Serena-SA` GitHub account |
| `EXPO_PUBLIC_DOMAIN` | Env var | Mobile | Base URL the mobile app uses to reach the API (e.g. `https://xyz.replit.dev/api-server`) |

**To rotate `JWT_SECRET`:** Change the value in Replit Secrets. All existing tokens become invalid; all users must log in again.

---

## 10. Authentication & Authorization

### Token Format

- **Algorithm:** HS256 (HMAC-SHA256)
- **Payload:** `{ id, username, role, iat, exp }`
- **Expiry:** 7 days (configurable in `auth.ts`)
- **Storage (mobile):** `expo-secure-store` (hardware-backed keychain on iOS/Android)

### Middleware (`lib/auth.ts`)

| Middleware | Used on | Effect |
|-----------|---------|--------|
| `requireAuth` | All protected routes | Returns 401 if no/invalid token |
| `requireSupervisor` | Supervisor routes | Returns 403 if role ≠ `supervisor`/`admin` |

### Registration Flow

1. Client sends `POST /auth/register` with plain-text password
2. Server hashes with `bcrypt` (10 rounds), stores hash
3. Server returns a signed JWT + user object
4. Mobile stores token in `SecureStore`, attaches to all subsequent requests as `Authorization: Bearer <token>`

---

## 11. Internationalisation (i18n)

**File:** `artifacts/wahatna-mobile/constants/i18n.ts`  
**Hook:** `const { t, isRTL } = useTranslation()` from `context/LanguageContext.tsx`

### Supported Languages

| Code | Language | Script | RTL |
|------|----------|--------|-----|
| `en` | English | Latin | No |
| `ar` | Arabic | Arabic | **Yes** |
| `ur` | Urdu | Nastaliq | **Yes** |
| `hi` | Hindi | Devanagari | No |

### RTL Layout

When `isRTL === true` (Arabic or Urdu), all flex rows flip direction:
```tsx
const rowDir: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
const textAlign: "left" | "right" = isRTL ? "right" : "left";
```

### Adding a Translation Key

1. Add the key to the `I18nStrings` interface in `i18n.ts`
2. Add the value to all four language dictionaries (`en`, `ar`, `ur`, `hi`)
3. Use `t("your_key")` in any component

### Key Translation Categories

| Prefix | Domain |
|--------|--------|
| `auth_*` | Login / register |
| `home_*` | Home screen |
| `report_*` | Report flow |
| `supervisor_*` | Supervisor dashboard |
| `fleet_*` | Fleet optimizer (GPS, modes, results, history) |
| `heat_ban_*` | MOHRE heat ban banner |
| `err_*` | Error messages |

---

## 12. Offline Support

The app functions without internet connectivity for the core reporting flow:

```
User submits report (offline)
        │
        ▼
OfflineQueueContext detects no network
        │
        ▼
Report saved to AsyncStorage ("offline_queue")
        │
        ▼
OfflineBanner shown to user
        │
Network restored
        │
        ▼
Queue replayed automatically → POST /report for each item
        │
        ▼
Queue cleared on success
```

**Queue persistence:** Survives app close/restart. Queue items include all form fields but NOT image blobs (images are referenced by local URI and re-uploaded on sync).

---

## 13. Development Setup

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Expo Go app (iOS/Android) or simulator
- Replit account with the project open

### Running in Replit (recommended)

All workflows are pre-configured. Use the Replit **Run** button or the workflow panel:

| Workflow | Command | Description |
|----------|---------|-------------|
| API Server | `pnpm --filter @workspace/api-server run dev` | Starts Express on `$PORT` |
| Mobile | `pnpm --filter @workspace/wahatna-mobile run dev` | Starts Expo dev server |

### Database Setup

```bash
# Push schema to DB (run once, or after schema changes)
pnpm --filter @workspace/db run push

# Seed with sample data (optional)
# Add seed call in artifacts/api-server/src/lib/seed.ts and run via API start
```

### Local Environment Variables

Set these in the Replit Secrets panel:
- `JWT_SECRET` — any long random string for development
- `DATABASE_URL` — auto-provided by Replit PostgreSQL

### Building for Production

```bash
# Build API server
pnpm --filter @workspace/api-server run build
# Output: artifacts/api-server/dist/index.mjs

# Build mobile (Expo)
pnpm --filter @workspace/wahatna-mobile run build
# Use EAS Build for App Store / Play Store submission
```

### Schema Changes

After modifying `lib/db/src/schema/wahatna.ts`:
```bash
pnpm --filter @workspace/db run push
# Applies changes to the live Replit database
# WARNING: push with force flag drops columns — use carefully
```

### TypeScript Checks

```bash
# API server
cd artifacts/api-server && pnpm exec tsc -p tsconfig.json --noEmit

# Mobile app
cd artifacts/wahatna-mobile && pnpm exec tsc -p tsconfig.json --noEmit
```

---

## 14. Key File Index

| File | What it does | When to edit |
|------|-------------|--------------|
| `lib/db/src/schema/wahatna.ts` | All DB table definitions | Adding/changing columns |
| `artifacts/api-server/src/lib/vision.ts` | Hazard classifier (stubbed CV) | Replacing with real CV model |
| `artifacts/api-server/src/lib/agent.ts` | Risk agent + BM25 knowledge base | Adding UAE safety protocols |
| `artifacts/api-server/src/lib/optimizer.ts` | GA fleet optimizer | Tuning GA params or switching to road-network distances |
| `artifacts/api-server/src/lib/auth.ts` | JWT middleware | Changing token expiry or roles |
| `artifacts/api-server/src/lib/heat.ts` | MOHRE heat ban logic | Adjusting ban dates/hours |
| `artifacts/api-server/src/routes/fleet.ts` | Fleet API endpoints | Adding fleet features |
| `artifacts/api-server/src/routes/report.ts` | Report submission + history | Changing report fields |
| `artifacts/api-server/src/routes/supervisor.ts` | Supervisor dashboard/management | Adding supervisor features |
| `artifacts/wahatna-mobile/constants/i18n.ts` | All 4-language strings | Adding any UI text |
| `artifacts/wahatna-mobile/context/LanguageContext.tsx` | Translation hook + RTL | Changing language switching logic |
| `artifacts/wahatna-mobile/context/AuthContext.tsx` | Token storage + user state | Changing auth flow |
| `artifacts/wahatna-mobile/context/OfflineQueueContext.tsx` | Offline report queue | Changing offline behaviour |
| `artifacts/wahatna-mobile/constants/colors.ts` | Oasis theme palette | Rebranding |
| `artifacts/wahatna-mobile/constants/mapHtml.ts` | Leaflet HTML template | Changing map style |
| `artifacts/wahatna-mobile/app/(tabs)/fleet.tsx` | Full fleet UI | Fleet screen changes |
| `scripts/post-merge.sh` | Post-task-merge automation | Adding merge hooks |

---

## 15. Known Limitations & Future Work

| Item | Status | Notes |
|------|--------|-------|
| Computer Vision | **Stubbed** | `vision.ts` maps categories deterministically. Confidence is always `null`. Replace `analyzeCategory()` with a real model to enable image-based classification. |
| Route distances | Haversine only | Straight-line estimates. UAE road network can be 30–60% longer due to desert terrain. Integration with OSRM or OpenRouteService recommended. |
| Push notifications | Token stored, not sent | `push_token` is saved per user but the API does not currently send notifications. Integrate Expo Push Notification service. |
| Route sharing | Not implemented | No way to share an optimised route with a field team device. Deep-link or QR code feature planned. |
| Photo upload auth | Server path only | Images stored on disk at `image_path`. No CDN or signed URL access. Consider object storage for production. |
| Supervisor export | Not implemented | No PDF/CSV report export for management. |
| Admin panel | Not implemented | `admin` role exists in DB but no dedicated screens. |
| Road-network routing | Not implemented | GA uses straight-line distances. |

---

## 16. Emergency Contacts & Protocols Embedded in App

The knowledge base (`agent.ts`) and classifier (`vision.ts`) contain the following UAE emergency contacts and references, surfaced to supervisors in incident reports:

| Hazard | Authority | Contact |
|--------|-----------|---------|
| Fire | UAE Civil Defence | **997** |
| Ambulance | Emergency | **998** |
| Police | Emergency | **999** |
| Electrical (Dubai) | DEWA | **991** |
| Electrical (Abu Dhabi) | ADDC | **800-2332** |
| Road hazards (Dubai) | RTA | **800-9090** |
| Road hazards (Abu Dhabi) | Dept. Municipalities & Transport | **800-555** |
| Flood / weather | NCM | UAE Alert app |
| Waste (Dubai) | Dubai Municipality | **800-900** |
| Waste (Abu Dhabi) | Municipality | **800-555** |
| HAZMAT | Civil Defence HAZMAT | **997** |
| Structural (Dubai) | Dubai Municipality Building Inspection | **+971 4 221 5555** |
| Heat ban violation | MOHRE | MOHRE app / website |

**MOHRE Heat Ban:** Outdoor work prohibited **12:30–15:00**, **15 June – 15 September** annually. Penalty: AED 5,000 per worker per violation.

---

*Document generated: June 2026*  
*Project: Wahatna — Al Qua'a Rural Safety Platform*  
*Repository: Serena-SA/Wahatna-Rural-Area-Reporting*
