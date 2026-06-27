# Wahatna — Final Handover Document

> **Wahatna** (واحتنا, "Our Oasis") is a rural municipal safety and incident-reporting platform built for the Al Qua'a region, UAE. Community reporters submit hazards with a photo; an AI pipeline (local **YOLO11n** computer vision + **K2 Think V2** reasoning) triages each report into a hazard category, severity, and an estimated government resolution time; supervisors manage incidents on a dashboard and plan optimised response routes. The app runs in Arabic, English, Urdu, and Hindi.

> **This document supersedes `WAHATNA_HANDOVER.md`** (June 2026), which described the AI as "stubbed" and predated the YOLO + K2 pipeline, the road-routing integration, and several API endpoints. The old file is kept for history; this one reflects the code as actually implemented.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack & Versions](#3-tech-stack--versions)
4. [Repository Structure](#4-repository-structure)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [AI Hazard Pipeline (YOLO + K2 Think)](#7-ai-hazard-pipeline-yolo--k2-think)
8. [Mobile App Screens](#8-mobile-app-screens)
9. [Key Algorithms & Modules](#9-key-algorithms--modules)
10. [Environment Variables & Secrets](#10-environment-variables--secrets)
11. [Authentication & Authorization](#11-authentication--authorization)
12. [Internationalisation (i18n)](#12-internationalisation-i18n)
13. [Offline Support](#13-offline-support)
14. [Development Setup](#14-development-setup)
15. [Key File Index](#15-key-file-index)
16. [Known Limitations & Future Work](#16-known-limitations--future-work)
17. [Emergency Contacts & Protocols Embedded in App](#17-emergency-contacts--protocols-embedded-in-app)

---

## 1. Project Overview

| Attribute | Value |
|-----------|-------|
| **App name** | Wahatna (واحتنا) |
| **Region** | Al Qua'a, Abu Dhabi, UAE |
| **Platform** | iOS + Android + Web (Expo / React Native) + REST API |
| **Languages** | English · Arabic (RTL) · Urdu (RTL) · Hindi |
| **AI** | Local YOLO11n detection + K2 Think V2 triage, with a local rule-based fallback |
| **GitHub** | `Serena-SA/Wahatna-Rural-Area-Reporting` |
| **Monorepo** | pnpm workspaces (originally developed on Replit) |

### User Roles

| Role | Access |
|------|--------|
| `user` | Submit hazard reports (Report tab), view own reports (My Reports), Home dashboard |
| `supervisor` | Incident list (Reports), Supervisor dashboard, status/notes/dispatch, Fleet route planner |
| `admin` | Same authorization as `supervisor` (no dedicated screens yet) |

> **Note:** New registrations are always created with role `user` (the register endpoint ignores any supplied role). Supervisor/admin accounts are provisioned via the seed script or by changing the role directly in the database.

### Core Workflow

```
Community reporter spots a hazard
        │
        ▼
Report tab (4-step wizard): location → category → photo + details → review
        │
        ▼
POST /api/report/analyze ──► local YOLO11n detects hazards in the photo
        │                    (bounding boxes drawn over the image)
        ▼
POST /api/report ──► K2 Think V2 reasons over (detections + description + category)
                  ──► picks hazard category, severity 1–5, government resolution ETA
                  ──► local agent.ts adds BM25 knowledge context + regulatory refs
                  ──► incident + report rows saved to DB, reporter awarded points
        │
        ▼
Supervisor dashboard (GET /api/supervisor/dashboard) — overdue auto-marked "late"
        │
        ▼
Supervisor updates status / adds notes / records resource dispatch
        │
        ▼
Supervisor uses Fleet screen to plan an optimised response route (GA + road routing)
        │
        ▼
Incident resolved → status "completed"
```

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      pnpm monorepo (workspaces)                        │
│                                                                        │
│  ┌──────────────────┐      ┌──────────────────────────┐               │
│  │  wahatna-mobile  │      │       api-server          │               │
│  │  (Expo / RN /    │─────►│  (Express 5 + TypeScript) │               │
│  │   RN-Web)        │ HTTP │  mounts all routes at /api │               │
│  └──────────────────┘      └───────┬──────────┬────────┘               │
│                                    │          │                        │
│                       ┌────────────▼──┐   ┌───▼────────────────┐       │
│                       │ lib/db        │   │ ml/detect_service  │       │
│                       │ (Drizzle ORM) │   │ (Python YOLO11n,   │       │
│                       │ PostgreSQL    │   │  127.0.0.1:8099)   │       │
│                       └───────────────┘   └────────────────────┘       │
└──────────────────────────────────────────────────────────────────────┘

External services (all optional — every one degrades gracefully):
  • K2 Think V2  — hazard triage reasoning (api.k2think.ai)        [K2THINK_API_KEY]
  • OpenRouteService — mode-aware road routing for the Fleet screen [ORS_API_KEY]
  • Nominatim (OpenStreetMap) — geocoding / reverse geocoding (mobile)
  • Device GPS — location capture
  • Expo Push Notifications — token stored per user (not yet sent)
```

### Data Flow — Hazard Report (two-stage)

```
Mobile                    API Server                    YOLO svc / K2 / DB
  │ POST /report/analyze   │                                  │
  │ (multipart image)      │── detectHazards() ──────────────►│ YOLO (local)
  │───────────────────────►│◄── boxes + dims ─────────────────│
  │◄── {image_filename,    │                                  │
  │     detections}        │                                  │
  │ (draw bounding boxes)  │                                  │
  │                        │                                  │
  │ POST /report           │                                  │
  │ (JSON: image_filename, │── assessWithK2() ───────────────►│ K2 Think V2
  │  detections, fields)   │◄── {category, severity, eta} ────│
  │───────────────────────►│── assessIncident() (agent.ts, BM25 + regs)
  │                        │── INSERT incidents, INSERT reports, UPDATE user score
  │◄── {incident_id,       │                                  │
  │     reference, vision, │                                  │
  │     assessment, score} │                                  │
```

The offline-sync path skips `/analyze`: the queued report replays through `POST /report` as multipart, and the server re-runs YOLO on the saved file before calling K2.

---

## 3. Tech Stack & Versions

### Backend — `artifacts/api-server`

| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | ≥ 20 | Runtime (uses native `fetch`, `--env-file`) |
| TypeScript | ~5.9 | Type safety |
| Express | ^5.2.1 | HTTP framework |
| Drizzle ORM | catalog | DB queries + migrations |
| `jsonwebtoken` | ^9.0.3 | JWT auth tokens (HS256) |
| `bcryptjs` | ^3.0.3 | Password hashing (10 rounds) |
| `multer` | ^2.2.0 | Multipart image uploads (≤ 10 MB, images only) |
| `pino` / `pino-http` | ^9.x / ^10.x | Structured logging |
| `cors` | ^2.8.6 | CORS headers |
| `cookie-parser` | ^1.4.7 | (present; cookies not currently used) |
| esbuild | 0.27.3 | Build bundler (`build.mjs`, `esbuild-plugin-pino`) |

### AI / ML — `artifacts/api-server/ml`

| Component | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11 | YOLO inference service runtime |
| `ultralytics` | ≥ 8.3.0 | YOLO11n model loading + inference (pulls PyTorch) |
| `best.pt` | committed | Trained YOLO11n weights (5 classes) |
| K2 Think V2 | `MBZUAI-IFM/K2-Think-v2` | Reasoning model (remote HTTP API) |

### Database — `lib/db`

| Package | Version | Purpose |
|---------|---------|---------|
| PostgreSQL | 16 | Primary datastore (via `DATABASE_URL`) |
| Drizzle ORM | catalog | Schema + query builder |
| `drizzle-kit` | ^0.31.x | Schema push / migrations |
| `pg` | ^8.x | Node postgres driver |
| `zod` | catalog | Validation (also `lib/api-zod`) |

### Mobile — `artifacts/wahatna-mobile`

| Package | Version | Purpose |
|---------|---------|---------|
| Expo | ~54.0.27 | RN framework + tooling |
| React Native | 0.81.5 | UI runtime |
| React | 19.x | (catalog) |
| Expo Router | ~6.0.17 | File-based navigation |
| React Native Reanimated | ~4.1.1 | Animations (scan line, K2 loader) |
| React Native SVG | 15.12.1 | Detection overlay boxes, icons |
| Expo Location | ~19.0.8 | GPS |
| Expo Image Picker | ~17.0.9 | Camera / gallery |
| Expo Notifications | ^0.32.17 | Push token registration |
| Expo Secure Store | ^15.0.8 | JWT token storage (keychain) |
| Expo Haptics | ~15.0.8 | Vibration feedback |
| AsyncStorage | 2.2.0 | Offline queue persistence |
| React Native WebView | 13.15.0 | Leaflet map rendering (native) |
| Expo Linear Gradient | ~15.0.8 | UI gradients |
| React Native Safe Area | ~5.6.0 | Notch / inset handling |

### Shared libraries — `lib/`

| Package | Purpose |
|---------|---------|
| `lib/db` (`@workspace/db`) | Drizzle client + schema |
| `lib/api-zod` (`@workspace/api-zod`) | Shared Zod request/response schemas |
| `lib/api-spec` | OpenAPI spec (future use) |
| `lib/api-client-react` | Generated/typed API client helpers |

---

## 4. Repository Structure

```
workspace/                              ← pnpm monorepo root
├── artifacts/
│   ├── api-server/                     ← Express REST API
│   │   ├── src/
│   │   │   ├── app.ts                  ← Express app factory (cors, json, pino, /api, /uploads)
│   │   │   ├── index.ts                ← Entry point (binds $PORT, runs seed on boot)
│   │   │   ├── lib/
│   │   │   │   ├── agent.ts            ← Local rule-based assessment + BM25 knowledge base
│   │   │   │   ├── auth.ts             ← JWT + bcrypt (requireAuth, requireSupervisor)
│   │   │   │   ├── heat.ts             ← MOHRE heat ban + temperature simulation
│   │   │   │   ├── k2think.ts          ← K2 Think V2 client (hazard triage)        ★ new
│   │   │   │   ├── yolo.ts             ← Client for the local YOLO service          ★ new
│   │   │   │   ├── logger.ts           ← Pino logger config
│   │   │   │   ├── optimizer.ts        ← Genetic-algorithm fleet router
│   │   │   │   ├── routing.ts          ← OpenRouteService road routing             ★ new
│   │   │   │   ├── seed.ts             ← Demo users + incidents (is_seed flagged)
│   │   │   │   ├── serialize.ts        ← Row → JSON serialisers
│   │   │   │   └── vision.ts           ← Category → label/severity profile (K2 fallback)
│   │   │   └── routes/
│   │   │       ├── index.ts            ← Route aggregator
│   │   │       ├── health.ts           ← GET /healthz                              ★ new
│   │   │       ├── auth.ts             ← /auth/register, /auth/login, /auth/me
│   │   │       ├── report.ts           ← /report/analyze, /report, /reports/my, /reports/:id
│   │   │       ├── dashboard.ts        ← /dashboard (home stats + leaderboard)     ★ new
│   │   │       ├── fleet.ts            ← /fleet/optimize, /fleet/jobs, /fleet/jobs/:id
│   │   │       ├── worker.ts           ← /worker/location, /worker/push-token
│   │   │       └── supervisor.ts       ← /supervisor/* (dashboard, reports, status, notes,
│   │   │                                  dispatch, delete, clear-demo)
│   │   ├── ml/                         ← Local YOLO service                        ★ new
│   │   │   ├── best.pt                 ← Trained YOLO11n weights (committed)
│   │   │   ├── detect_service.py       ← stdlib HTTP service, POST /detect @ :8099
│   │   │   ├── requirements.txt        ← ultralytics
│   │   │   └── .venv/                  ← virtualenv (gitignored)
│   │   ├── build.mjs                   ← esbuild bundler script
│   │   ├── .env / .env.example         ← runtime secrets (.env gitignored)
│   │   └── package.json
│   │
│   ├── wahatna-mobile/                 ← Expo React Native app (iOS / Android / Web)
│   │   ├── app/
│   │   │   ├── _layout.tsx             ← Root layout + providers
│   │   │   ├── index.tsx               ← Entry / auth gate
│   │   │   ├── login.tsx · register.tsx
│   │   │   └── (tabs)/
│   │   │       ├── _layout.tsx         ← Role-aware tab bar
│   │   │       ├── index.tsx           ← Home dashboard + awareness cards
│   │   │       ├── report.tsx          ← 4-step report wizard + YOLO/K2 visual flow
│   │   │       ├── my-reports.tsx      ← Reporter's incident history (users)
│   │   │       ├── reports.tsx         ← Incident list (supervisors)
│   │   │       ├── supervisor.tsx      ← Supervisor management dashboard
│   │   │       ├── fleet.tsx           ← Fleet route optimizer (supervisors)
│   │   │       └── dashboard.tsx       ← Legacy, hidden (deep-link compat only)
│   │   ├── components/
│   │   │   ├── GlassCard.tsx · SeverityBadge.tsx · OfflineBanner.tsx
│   │   │   ├── RouteMap.tsx · RouteMap.web.tsx   ← Leaflet map (native / web)
│   │   │   ├── DetectionOverlay.tsx    ← Draws YOLO bounding boxes               ★ new
│   │   │   ├── K2ThinkingLoader.tsx    ← "K2 Think V2 thinking…" animation       ★ new
│   │   │   ├── AwarenessCards.tsx      ← Home safety-awareness cards             ★ new
│   │   │   ├── HeatBanner.tsx          ← MOHRE heat-ban banner                   ★ new
│   │   │   ├── DesertBackground.tsx    ← Themed background                       ★ new
│   │   │   ├── ErrorBoundary.tsx · ErrorFallback.tsx                            ★ new
│   │   │   └── KeyboardAwareScrollViewCompat.tsx                                ★ new
│   │   ├── constants/
│   │   │   ├── env.ts                  ← API base-URL resolution
│   │   │   ├── api.ts                  ← apiPost/apiGet + geocode()
│   │   │   ├── colors.ts · heat.ts · i18n.ts · mapHtml.ts
│   │   ├── context/
│   │   │   ├── AuthContext.tsx · LanguageContext.tsx · OfflineQueueContext.tsx
│   │   ├── hooks/
│   │   │   ├── useColors.ts · useNetworkState.ts
│   │   ├── server/                     ← share.js (Cloudflare tunnel demo), serve.js
│   │   └── scripts/build.js            ← Expo web build
│   │
│   └── mockup-sandbox/                 ← design/mockup playground (not shipped)
│
├── lib/
│   ├── db/                             ← @workspace/db (Drizzle client + schema/wahatna.ts)
│   ├── api-zod/                        ← @workspace/api-zod (shared Zod schemas)
│   ├── api-spec/                       ← OpenAPI spec (future)
│   └── api-client-react/               ← typed client helpers
│
├── docs/
│   ├── FINAL_HANDOVER.md               ← THIS FILE
│   ├── FINAL_HANDOVER.docx             ← Word version of this file
│   ├── AI_PIPELINE.md                  ← Deep-dive on YOLO + K2
│   ├── SESSION_HANDOUT.md
│   ├── WAHATNA_HANDOVER.md (.docx)     ← superseded original (kept for history)
├── scripts/
├── package.json                        ← root pnpm workspace config
└── pnpm-workspace.yaml
```

★ = added/changed since the original `WAHATNA_HANDOVER.md`.

---

## 5. Database Schema

All tables live in `lib/db/src/schema/wahatna.ts` (PostgreSQL 16, accessed via `DATABASE_URL`). Drizzle uses camelCase TS field names mapped to snake_case columns.

### `users` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `username` | text UNIQUE NOT NULL | Login name |
| `email` | text UNIQUE NOT NULL | |
| `password_hash` | text NOT NULL | bcrypt (10 rounds) |
| `full_name` | text | |
| `role` | text DEFAULT `'user'` | `user` \| `supervisor` \| `admin` |
| `employee_id` | text | Municipal employee ID (seed only) |
| `shift_active` | boolean DEFAULT false | |
| `hazard_score` | integer DEFAULT 0 | Gamification points |
| `streak_days` | integer DEFAULT 0 | |
| `total_reports` | integer DEFAULT 0 | |
| `last_known_lat` / `last_known_lon` | double | Last GPS position |
| `push_token` | text | Expo push token (stored, not yet used to send) |
| `preferred_language` | text DEFAULT `'en'` | `en` \| `ar` \| `ur` \| `hi` |
| `created_at` / `updated_at` | timestamp | |

### `incidents` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | integer FK → users | Reporter |
| `lat` / `lon` | double NOT NULL | WGS84 |
| `location_name` | text | Reverse-geocoded address |
| `threat_class` | text NOT NULL | Internal class key (e.g. `fire_hazard`) |
| `threat_label` | text | Human-readable label |
| `confidence` | double | **Top YOLO detection confidence** (null if no detection) |
| `detections` | text | ★ JSON: `[{label, confidence, box:[x1,y1,x2,y2] normalised 0–1}]` |
| `analysis_source` | text | ★ Provenance: `yolo+k2`, `user+k2`, `yolo+local`, `user+local` |
| `eta_text` | text | ★ K2's human ETA, e.g. "about 2 days" |
| `is_seed` | boolean DEFAULT false | ★ Marks demo rows so "Clear demo" never touches real reports |
| `severity` | integer DEFAULT 3 | 1 (Low) – 5 (Critical) |
| `severity_label` | text DEFAULT `'elevated'` | `Low`/`Moderate`/`Elevated`/`High`/`Critical` |
| `secondary_threats` | text | JSON array string |
| `heat_index_estimate` | double | °C estimate (heat-stress only) |
| `risk_level` | text | Risk level label |
| `risk_score` | integer | Mirrors severity |
| `assessment_summary` | text | K2 reasoning + local summary |
| `recommended_protocol` | text | Action steps (K2 or local) |
| `regulatory_reference` | text | UAE law / authority reference |
| `dialect_note` | text | Emirati dialect term detection |
| `report_text` | text | Reporter's free text |
| `image_path` / `image_filename` | text | Uploaded image (served at `/uploads/...`) |
| `status` | text DEFAULT `'pending_review'` | See lifecycle below |
| `due_at` | timestamp | SLA deadline (K2 ETA when available, else severity SLA) |
| `escalation_required` | boolean DEFAULT false | Set true when overdue |
| `escalated_at` | timestamp | |
| `escalation_level` | integer DEFAULT 0 | |
| `supervisor_notes` | text | |
| `rejection_reason` | text | Required when status = `rejected` |
| `status_history` | text | JSON: `[{status, timestamp, note}]` |
| `location_source` | text | `gps` \| `pin` \| `address` |
| `address_details` | text | |
| `phone_primary` / `phone_secondary` | text | Reporter contact |
| `resources_dispatched_at` | timestamp | ★ When a supervisor dispatched water/food |
| `resources_dispatched_by` | integer FK → users | ★ Which supervisor dispatched |
| `created_at` / `updated_at` | timestamp | |

**Incident status lifecycle:**

```
pending_review → under_review → assigned → completed
                             └──────────► rejected   (rejection_reason required)
        (due_at passed, not terminal) ──► late        (auto-set; escalation_required=true)
```

> The seed script writes legacy statuses (`active`, `investigating`, `resolved`) on demo rows; the home `/dashboard` endpoint simply excludes `resolved`. The supervisor flow uses the lifecycle above.

**SLA rules (`agent.ts → calculateDueAt`)** — used when K2 does **not** supply an ETA:

| Severity | SLA |
|----------|-----|
| 5 (Critical) | 6 hours |
| 4 (High) | 24 hours |
| 3 (Elevated) | 72 hours |
| 1–2 (Low/Moderate) | 144 hours (6 days) |

When K2 returns `eta_hours`, `due_at = now + eta_hours` instead.

### `fleet_waypoints` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `job_id` | text | 8-char UUID prefix grouping one route job |
| `user_id` | integer FK → users | Dispatcher |
| `transport_mode` | text | `walking` \| `car` \| `service_vehicle` |
| `total_distance_km` | double | Optimised route total |
| `lat` / `lon` | double NOT NULL | Stop coordinates |
| `label` | text | Stop name |
| `optimized_order` | integer | 1-based position |
| `distance_to_next_km` | double | Leg distance to next stop |
| `created_at` | timestamp | |

### `reports` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | integer FK → users NOT NULL | |
| `incident_id` | integer FK → incidents | Links to the incident |
| `lat` / `lon` | double NOT NULL | |
| `report_text` | text | |
| `image_filename` | text | |
| `score_awarded` | integer DEFAULT 0 | Points earned (`severity × 50`) |
| `created_at` | timestamp | |

---

## 6. API Reference

**Base URL:** `<origin>/api` — the mobile app resolves `<origin>` via `constants/env.ts`
(`EXPO_PUBLIC_API_URL` → web same-origin → `https://$EXPO_PUBLIC_DOMAIN` → `http://localhost:8080`).
**Auth header:** `Authorization: Bearer <access_token>`
**Content-Type:** `application/json` (file uploads use `multipart/form-data`).
Uploaded images are served statically from `/uploads/<filename>`.

### Health

#### `GET /api/healthz`
Returns `{ "status": "ok" }`. No auth.

---

### Auth Routes

#### `POST /api/auth/register`
Create a new account. **Role is always `user`** regardless of input.

**Request body:**
```json
{ "username": "ali_worker", "email": "ali@example.com", "password": "SecurePass123", "full_name": "Ali Hassan" }
```
**Response 201:**
```json
{ "access_token": "<jwt>", "token_type": "bearer", "user": { "id": 1, "username": "ali_worker", "role": "user", ... } }
```
Errors: `400` if username/email already taken or fields missing.

#### `POST /api/auth/login`
**Request:** `{ "username": "ali_worker", "password": "SecurePass123" }`
**Response 200:** `{ "access_token": "<jwt>", "token_type": "bearer", "user": { ... } }`
Errors: `401` invalid credentials.

#### `GET /api/auth/me`
🔒 Returns the current user profile (`userDict`).

---

### Report Routes

#### `POST /api/report/analyze`
🔒 **Stage 1.** `multipart/form-data` with an `image`. Saves the file, runs YOLO, returns detections so the app can draw boxes. **Creates no incident.**

**Response 200:**
```json
{ "image_filename": "1719500000-ab12cd.jpg", "width": 1280, "height": 960,
  "detections": [ { "label": "fire", "confidence": 0.91, "box": [0.12,0.30,0.48,0.77] } ] }
```

#### `POST /api/report`
🔒 **Stage 2 / finalise.** Accepts either:
- JSON with `image_filename` + `detections` (online interactive path), or
- `multipart/form-data` with a fresh `image` (offline-sync path; YOLO re-runs server-side).

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `lat` / `lon` | number | ✅ | WGS84 |
| `category` | string | | Reporter's choice; K2 may override |
| `report_text` | string | | Free text |
| `detections` | JSON/string | | From `/analyze` (else re-run from image) |
| `image_filename` | string | | From `/analyze` |
| `image` | file | | Only on the multipart/offline path |
| `location_source` | string | | `gps` \| `pin` \| `address` |
| `address_details`, `phone_primary`, `phone_secondary` | string | | |

**Hazard categories:** `fire`, `flood`, `road_damage`, `electrical`, `heat_stress`, `waste`, `structural`, `other`.

**Response 201:**
```json
{
  "incident_id": 42,
  "reference": "WAH-00042",
  "due_at": "2026-06-28T10:00:00.000Z",
  "vision": {
    "threat_class": "fire_hazard", "threat_label": "Fire Hazard",
    "confidence": 0.91, "chosen_category": "fire",
    "detections": [ ... ], "severity": 4, "severity_label": "High"
  },
  "assessment": {
    "risk_level": "High", "risk_score": 4,
    "assessment_summary": "…K2 reasoning + local summary…",
    "recommended_protocol": "Evacuate and call Civil Defence (997).",
    "regulatory_reference": "UAE Civil Defence Fire & Life Safety Code",
    "eta_text": "about 4 hours", "analysis_source": "yolo+k2",
    "context_sources": ["civil_defence_fire", "hazmat_protocol"]
  },
  "score_awarded": 200,
  "worker_total_score": 1440,
  "created_at": "2026-06-27T06:00:00.000Z"
}
```

#### `GET /api/reports/my`
🔒 The authenticated user's own incidents (latest 50), via `reportDict`.

#### `GET /api/reports/:id`
🔒 Full detail of one incident the user reported.

---

### Home Dashboard

#### `GET /api/dashboard`
🔒 Any authenticated user. Active incidents (status ≠ `resolved`, latest 50), severity summary, heat compliance, and the top-5 worker leaderboard.

**Response:**
```json
{
  "active_incidents": [ { ...reportDict... } ],
  "summary": { "total_active": 12, "critical_count": 1, "high_count": 3, "medium_count": 6 },
  "heat_compliance": { "ban_active": true, "current_temp_c": 46.3, "risk_level": "critical" },
  "leaderboard": [ { "username": "fatima.khalid", "score": 3850, "rank": 1 } ],
  "generated_at": "…"
}
```

---

### Supervisor Routes  *(require role `supervisor` or `admin`)*

#### `GET /api/supervisor/dashboard`
🔒🔑 Auto-marks overdue incidents `late`. Returns status counts, `critical_count`, `late_count`, `total`, and up to 20 active incidents (each enriched with `reporter_username`).

#### `GET /api/supervisor/reports`
🔒🔑 Filterable list (also auto-marks overdue).
**Query params:** `status`, `severity_min`, `severity_max`, `late_only=true`, `category`, `date_from`.
**Response:** `{ "reports": [ … ], "total": N }`.

#### `PATCH /api/supervisor/reports/:id/status`
🔒🔑 Body: `{ "status": "...", "note": "...", "rejection_reason": "..." }`.
Valid statuses: `pending_review`, `under_review`, `assigned`, `completed`, `rejected`, `late`.
`rejection_reason` required when `status = "rejected"`. Appends to `status_history`.

#### `PATCH /api/supervisor/reports/:id/notes`
🔒🔑 Body: `{ "notes": "Assigned to Team B…" }`.

#### `PATCH /api/supervisor/reports/:id/dispatch`
🔒🔑 Records that water/food was dispatched (`resources_dispatched_at`, `resources_dispatched_by`). No body required.

#### `DELETE /api/supervisor/reports/:id`
🔒🔑 Hard-deletes an incident and its dependent `reports` rows (transaction). Returns `{ "deleted": id }`.

#### `POST /api/supervisor/reports/clear-demo`
🔒🔑 Deletes all seeded demo incidents (`is_seed = true`) and their reports. Returns `{ "deleted": N }`. Real community reports are never matched.

---

### Fleet Routes

#### `POST /api/fleet/optimize`
🔒 Runs the GA optimiser; if `ORS_API_KEY` is set, replaces the straight-line estimate with a real mode-aware road route + geometry (falls back to Haversine on any ORS failure).

**Request:**
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
1–50 waypoints; `priority` defaults to 3. `transport_mode` ∈ `walking` | `car` | `service_vehicle`.

**Response (abridged):**
```json
{
  "job_id": "a3f2b1c4", "transport_mode": "service_vehicle", "routed": true,
  "original_route": { "stops": [ … ], "total_distance_km": 3.5, "estimated_time_min": 7.0 },
  "optimized_route": { "stops": [ { "order": 1, "label": "School",
      "priority_note": "Moved to position 1 (was 2) — critical priority", … } ],
    "total_distance_km": 2.9, "estimated_time_min": 5.8 },
  "geometry": [ [24.12,55.56], … ],
  "priority_explanation": ["School: Moved to position 1 (was 2) — critical priority"],
  "metrics": { "distance_saved_km": 0.6, "time_saved_min": 1.2, "improvement_pct": 17.1,
               "speed_kmh": 30, "elapsed_ms": 42 }
}
```
`routed` is `true` when a real road route was used, `false` for straight-line. `geometry` is `[lat, lon]` points for a Leaflet polyline.

#### `GET /api/fleet/jobs`
🔒 Last 20 route jobs for the user: `{ jobs: [{ jobId, transportMode, totalDistanceKm, stopCount, createdAt }] }`.

#### `GET /api/fleet/jobs/:jobId`
🔒 Full stop list for one job (scoped to the requester; cross-user → `404`).

---

### Worker Routes

#### `PATCH /api/worker/location`
🔒 Body `{ "lat": 24.12, "lon": 55.56 }` → updates last-known GPS.

#### `POST /api/worker/push-token`
🔒 Body `{ "push_token": "ExponentPushToken[...]" }` (accepts `token` too) → stores the Expo push token.

---

## 7. AI Hazard Pipeline (YOLO + K2 Think)

The headline feature, and the biggest change from the original handover (which described vision as "stubbed"). Full deep-dive: `docs/AI_PIPELINE.md`.

```
photo ─▶ YOLO11n (local, best.pt) ─▶ detections (labels + normalised boxes)
                                          │
description + chosen category ────────────┼─▶ K2 Think V2 ─▶ { hazard_category, severity 1–5,
                                          │                    eta_hours, eta_text,
                                          │                    reasoning, recommended_action }
                                          ▼
                            incident created (due_at = now + eta, detections stored,
                                              analysis_source recorded)
```

### 7.1 YOLO detection — `lib/yolo.ts` + `ml/detect_service.py`
- **Model:** YOLO11n weights at `ml/best.pt`, 5 trained classes: `chemical hazard`, `fire`, `no helmet`, `smoke`, `water leak`.
- **Service:** `detect_service.py` (Python stdlib HTTP) loads the model once and serves `POST /detect` and `GET /health` on `127.0.0.1:8099`. Node reaches it via `YOLO_SERVICE_URL`.
- **Graceful degradation:** service down → `available:false` → pipeline uses the reporter's chosen category. 25 s request timeout.

### 7.2 K2 Think V2 triage — `lib/k2think.ts`
- Model `MBZUAI-IFM/K2-Think-v2` at `K2THINK_URL` (default `https://api.k2think.ai/v1/chat/completions`), `stream:false`, `temperature:0.2`, 90 s timeout.
- Prompted with the detections + the reporter's description + chosen category; must return one compact JSON object. The client strips `<think>…</think>` reasoning and parses the **last** balanced `{…}` block.
- Output is sanitised: category clamped to the app's 8 categories (else reporter's choice), severity clamped 1–5, `eta_hours` defaulted to 72 if invalid.
- **Activation:** present only when `K2THINK_API_KEY` is set. No key, or any HTTP/parse error → caller falls back to the local agent.

### 7.3 `analysis_source` matrix

| Detection | K2 | `analysis_source` |
|-----------|----|--------------------|
| YOLO found something | available | `yolo+k2` |
| No detection | available | `user+k2` |
| YOLO found something | unavailable | `yolo+local` |
| No detection | unavailable | `user+local` |

### 7.4 What the reporter sees (`report.tsx`)
1. **Scanning** — photo with an animated scan line while YOLO runs.
2. **Bounding boxes** — `DetectionOverlay.tsx` draws class + confidence (or "no hazard detected").
3. **Thinking** — `K2ThinkingLoader.tsx` "K2 Think V2 thinking…".
4. **Result** — hazard type, severity badge, estimated government resolution time, "Analyzed by YOLO + K2 Think V2".

---

## 8. Mobile App Screens

### Auth

| Screen | File | Notes |
|--------|------|-------|
| Login | `app/login.tsx` | Username + password; token in SecureStore |
| Register | `app/register.tsx` | Creates a `user` account; language preference |

### Tabs (role-aware — `app/(tabs)/_layout.tsx`)

| Tab | File | Visible to | Description |
|-----|------|-----------|-------------|
| Home | `(tabs)/index.tsx` | All | Greeting, MOHRE heat-ban banner, safety stats, awareness cards, quick actions |
| Report | `(tabs)/report.tsx` | **Users** | 4-step wizard + YOLO/K2 visual flow |
| Reports | `(tabs)/reports.tsx` | **Supervisors** | Full incident list with filters |
| My Reports | `(tabs)/my-reports.tsx` | **Users** | Personal incident history |
| Supervisor | `(tabs)/supervisor.tsx` | **Supervisors** | Dashboard stats, status/notes/dispatch |
| Fleet | `(tabs)/fleet.tsx` | **Supervisors** | GA route optimiser + road routing |
| Dashboard | `(tabs)/dashboard.tsx` | Hidden | Legacy, kept for deep-link compatibility |

> Correction to the original handover: **Report is users-only** and **Fleet is supervisors-only** (the old doc listed both as "All").

### Report wizard (`report.tsx`)
Four steps — **location → category → photo + details → review** — then phases `wizard → analyzing (YOLO) → thinking (K2) → confirmed`. Emergency categories (`fire`, `electrical`, `structural`) surface emergency-call prompts. Offline submissions are queued.

### Fleet screen (`fleet.tsx`)
1. **Start location** — GPS on mount; manual lat/lon + OS-specific settings hint if denied.
2. **Transport mode** — Walking (5 km/h) · Car (40 km/h) · Service Vehicle (30 km/h).
3. **Destination waypoints** — geocode via Nominatim, add stops, set priority (Low/Medium/High/Critical).
4. **Optimise** — savings banner + side-by-side Original vs Optimised, per-stop priority notes, map polyline (real road geometry when ORS is configured).
5. **Route history** — last 20 jobs; tap to replay into the editor.

---

## 9. Key Algorithms & Modules

### 9.1 Hazard category profiles — `vision.ts`
No longer the classifier — it maps a (K2- or user-) chosen category to a deterministic profile (threat class, human label, baseline severity, recommended action, secondary threats). `analyzeCategory()` is called after K2 to fill labels/regulatory context; `confidence` is set from the top YOLO detection.

### 9.2 Local assessment agent — `agent.ts`
Fully local fallback + context provider:
1. **UAE knowledge base** — 11 in-process docs (MOHRE heat ban, Civil Defence fire, structural inspection, wadi flood, HAZMAT, DEWA/ADDC electrical, RTA road, dust storm, Emirati dialect terms, heat-stress thresholds, waste/sanitation).
2. **BM25 retrieval** — `retrieveContext(query, topK=3)` scores docs against threat class + report text; `context_sources` records the doc ids used.
3. **Dialect detection** — flags Emirati/Gulf terms (`ta3ban`, `harara`, `suyool`, `mafi mushkila`, …).
4. **SLA** — `calculateDueAt(severity)` (table in §5) when K2 gives no ETA.
5. **`assessIncident()`** — combines the above into the assessment attached to every incident.

### 9.3 Fleet optimiser — `optimizer.ts`
Genetic algorithm, priority-weighted open-path fitness:
`F(route) = openPathDistance(start→stops) + Σ(priority_i × position_i × 0.3)`.
Operators: tournament selection (k=5), ordered crossover (OX), swap mutation (rate 0.02), elitism. Distances via Haversine. `optimize()` (legacy closed-cycle TSP) also exists; the fleet endpoint uses `optimizeFleetRoute()`. Speeds: walking 5, service_vehicle 30, car 40 km/h.

### 9.4 Road routing — `routing.ts`
Wraps **OpenRouteService**. Maps transport mode → ORS profile (`foot-walking`, `driving-hgv`, `driving-car`), requests a route through the optimised stop sequence with `radiuses:-1` (essential for rural/desert points far from mapped roads), and returns distance, duration, per-leg km, and `[lat,lon]` geometry. Enabled by `ORS_API_KEY`; null/fallback to Haversine otherwise. 8 s timeout.

### 9.5 MOHRE heat ban + temperature — `heat.ts`
- `isHeatBanActive()` — bans outdoor work **12:30–15:00 GST (UTC+4), 15 Jun – 15 Sep**.
- `simulateTemperatureC()` — diurnal curve peaking ~14:00 (seasonal base 38 °C summer / 26 °C otherwise).
- `temperatureRiskLevel()` — low/moderate/elevated/high/critical thresholds. All pure date/time logic, no external API.

### 9.6 Offline queue — `OfflineQueueContext.tsx`
- Persists unsent reports in AsyncStorage under `wahatna_offline_queue`; survives restart.
- `retryAll(token)` replays pending/failed items as multipart `POST /report` (server re-runs YOLO).
- **Duplicate protection:** blocks a non-synced item with the same category within ~100 m (`< 0.001°`) submitted in the last 5 minutes (overridable with `force`).
- Image stored by local URI and re-uploaded on sync.

---

## 10. Environment Variables & Secrets

> Backend secrets live in `artifacts/api-server/.env` (gitignored; template in `.env.example`). The server is started with `node --env-file=.env`.

| Key | Scope | Required | Description |
|-----|-------|----------|-------------|
| `PORT` | Backend | ✅ | Express port (e.g. 8080; matches the mobile localhost fallback) |
| `DATABASE_URL` | Backend | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | Backend | ✅ | HMAC secret for JWTs (server throws on boot if missing) |
| `K2THINK_API_KEY` | Backend | Optional | Enables K2 Think triage; blank → local agent fallback |
| `K2THINK_URL` / `K2THINK_MODEL` | Backend | Optional | Override K2 endpoint / model |
| `ORS_API_KEY` | Backend | Optional | Enables real road routing; blank → straight-line |
| `YOLO_SERVICE_URL` | Backend | Optional | Defaults to `http://127.0.0.1:8099` |
| `EXPO_PUBLIC_API_URL` | Mobile | Optional | Explicit API origin (e.g. LAN IP for a physical device) |
| `EXPO_PUBLIC_DOMAIN` | Mobile | Optional | Hosted API domain (https) |

**Rotating `JWT_SECRET`:** change it and restart — all existing tokens become invalid; users must log in again.

---

## 11. Authentication & Authorization

### Token format
- **Algorithm:** HS256. **Expiry:** 7 days.
- **Payload:** `{ username, role, sub: <userId>, iat, exp }` — the user id is the JWT `subject` (`sub`), not an `id` claim.
- **Storage (mobile):** `expo-secure-store`.
- **Responses** return `{ access_token, token_type: "bearer", user }`.

### Middleware (`lib/auth.ts`)

| Middleware | Used on | Effect |
|-----------|---------|--------|
| `requireAuth` | All protected routes | Verifies the bearer token, loads the user, else `401` |
| `requireSupervisor` | Supervisor routes | `403` unless role is `supervisor`/`admin` |

### Registration flow
1. `POST /auth/register` with a plaintext password.
2. Server bcrypt-hashes (10 rounds), stores the hash, **forces role `user`**.
3. Returns a signed JWT + user object.
4. Mobile stores the token in SecureStore and attaches `Authorization: Bearer <token>`.

---

## 12. Internationalisation (i18n)

**File:** `artifacts/wahatna-mobile/constants/i18n.ts` · **Hook:** `const { t, isRTL } = useTranslation()` from `context/LanguageContext.tsx`.

| Code | Language | Script | RTL |
|------|----------|--------|-----|
| `en` | English | Latin | No |
| `ar` | Arabic | Arabic | **Yes** |
| `ur` | Urdu | Nastaliq | **Yes** |
| `hi` | Hindi | Devanagari | No |

`isRTL` comes from the active dictionary (`DICTIONARIES[language].isRTL`); when true, flex rows flip (`row-reverse`) and text aligns right. Adding a key: extend the strings interface, add the value to all four dictionaries, use `t("key")`. Prefixes: `auth_*`, `home_*`, `report_*`, `supervisor_*`, `fleet_*`, `heat_ban_*`, `err_*`.

---

## 13. Offline Support

```
Submit report (offline)
   └─► OfflineQueueContext detects no network
         └─► report saved to AsyncStorage ("wahatna_offline_queue")
               └─► OfflineBanner shown
Network restored
   └─► retryAll() replays queue → multipart POST /report (each item)
         └─► server re-runs YOLO + K2 → synced items cleared
```

Queue survives app restart. Items carry all form fields plus a local image URI (re-uploaded on sync). Duplicate guard: same category within ~100 m in the last 5 minutes.

---

## 14. Development Setup

### Prerequisites
- Node.js ≥ 20, pnpm ≥ 9
- PostgreSQL 16 (local or hosted)
- Python 3.11 (for the local YOLO service)
- Expo Go / simulator (for native) or a browser (web)

### Install & database
```bash
pnpm install
# Push schema to the DB (run once / after schema changes)
pnpm --filter @workspace/db run push     # drizzle-kit push  (force flag drops columns — careful)
```

### Backend
```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env   # fill PORT, DATABASE_URL, JWT_SECRET, keys
pnpm --filter @workspace/api-server run dev   # esbuild → node --enable-source-maps dist/index.mjs
# Seed demo users + incidents runs automatically on boot (idempotent).
```

### Local YOLO service (enables real detection)
```bash
cd artifacts/api-server/ml
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# .venv/bin/python  on macOS/Linux
.venv/Scripts/python detect_service.py                    # serves 127.0.0.1:8099
```

### Mobile
```bash
pnpm --filter @workspace/wahatna-mobile run start:local   # Expo (native)
pnpm --filter @workspace/wahatna-mobile run web:local     # web
# Point a physical device at your machine:
EXPO_PUBLIC_API_URL=http://<LAN-IP>:8080 pnpm --filter @workspace/wahatna-mobile run start:local
```

### One-command public demo (web + API + YOLO over a Cloudflare tunnel)
```bash
cd artifacts/wahatna-mobile
pnpm share          # or: pnpm share:rebuild  (after code changes)
```
Starts the YOLO detector, the API, serves the built web app, and prints a public `https://…trycloudflare.com` URL + QR. The link changes on restart.

### Builds & checks
```bash
pnpm --filter @workspace/api-server run build      # dist/index.mjs
pnpm --filter @workspace/wahatna-mobile run build  # scripts/build.js (Expo web)  → EAS for stores
pnpm run typecheck                                 # whole workspace
```

### Seed accounts (password `wahatna2024`)
| Username | Role |
|----------|------|
| `supervisor` | supervisor |
| `fatima.khalid` | supervisor |
| `demo` | user |
| `ahmed.al.rashidi` | user |

---

## 15. Key File Index

| File | What it does | When to edit |
|------|-------------|--------------|
| `lib/db/src/schema/wahatna.ts` | All DB tables | Adding/changing columns |
| `artifacts/api-server/src/lib/yolo.ts` | YOLO service client | Detector host/timeout |
| `artifacts/api-server/src/lib/k2think.ts` | K2 Think client + prompt | Triage prompt / output schema |
| `artifacts/api-server/ml/detect_service.py` | Python YOLO server | Model/classes/inference |
| `artifacts/api-server/src/lib/agent.ts` | Local assessment + BM25 KB | UAE protocols, SLA, fallback |
| `artifacts/api-server/src/lib/vision.ts` | Category profiles | Labels/severity per category |
| `artifacts/api-server/src/lib/optimizer.ts` | GA fleet optimiser | Tuning GA / fitness |
| `artifacts/api-server/src/lib/routing.ts` | ORS road routing | Routing profiles/fallback |
| `artifacts/api-server/src/lib/heat.ts` | Heat ban + temp simulation | Ban dates/hours/thresholds |
| `artifacts/api-server/src/lib/auth.ts` | JWT + bcrypt middleware | Token expiry / roles |
| `artifacts/api-server/src/routes/report.ts` | Report analyze + submit | Report pipeline/fields |
| `artifacts/api-server/src/routes/supervisor.ts` | Supervisor management | Supervisor features |
| `artifacts/api-server/src/routes/fleet.ts` | Fleet endpoints | Fleet features |
| `artifacts/api-server/src/routes/dashboard.ts` | Home dashboard stats | Home stats/leaderboard |
| `artifacts/api-server/src/lib/serialize.ts` | Row → JSON shapes | API response fields |
| `artifacts/api-server/src/lib/seed.ts` | Demo data | Demo users/incidents |
| `artifacts/wahatna-mobile/app/(tabs)/report.tsx` | Report wizard + AI flow | Report UX |
| `artifacts/wahatna-mobile/components/DetectionOverlay.tsx` | YOLO box overlay | Detection UI |
| `artifacts/wahatna-mobile/components/K2ThinkingLoader.tsx` | K2 loader | Thinking UI |
| `artifacts/wahatna-mobile/context/OfflineQueueContext.tsx` | Offline queue | Offline behaviour |
| `artifacts/wahatna-mobile/constants/env.ts` | API base URL | URL resolution |
| `artifacts/wahatna-mobile/constants/i18n.ts` | 4-language strings | Any UI text |

---

## 16. Known Limitations & Future Work

| Item | Status | Notes |
|------|--------|-------|
| YOLO classes | 5 only | `chemical hazard`, `fire`, `no helmet`, `smoke`, `water leak`. Retrain `best.pt` to add more. |
| K2 dependency | External, optional | Needs `K2THINK_API_KEY`; falls back to local agent if absent/failing. |
| YOLO runtime | Local Python service | Must be running for detection; otherwise reports use the reporter's category. |
| Road distances | ORS or Haversine | Without `ORS_API_KEY`, Fleet uses straight-line (30–60% short in desert terrain). |
| Push notifications | Token stored, not sent | `push_token` saved; no send pipeline yet. |
| Supervisor `critical_count` | Quirk | `/supervisor/dashboard` counts `severity >= 7`, but severities are 1–5, so it currently reads 0. The home `/dashboard` counts critical as `severity >= 5`. Align before relying on it. |
| Image storage | Local disk | Served from `/uploads`; no CDN/signed URLs. Consider object storage for production. |
| Admin panel | Not implemented | `admin` shares supervisor authorization; no dedicated screens. |
| Export | Not implemented | No PDF/CSV export for management. |

---

## 17. Emergency Contacts & Protocols Embedded in App

Surfaced to supervisors via `agent.ts` (knowledge base + regulatory references) and category profiles in `vision.ts`.

| Hazard | Authority | Contact |
|--------|-----------|---------|
| Fire | UAE Civil Defence | **997** |
| Ambulance | Emergency | **998** |
| Police | Emergency | **999** |
| Electrical (Dubai) | DEWA | **991** |
| Electrical (Abu Dhabi) | ADDC | **800-2332** |
| Road hazards (Dubai) | RTA | **800-90-90** |
| Road hazards (Abu Dhabi) | Dept. Municipalities & Transport | **800-555** |
| Flood / weather | NCM | UAE Alert app |
| Waste (Dubai) | Dubai Municipality | **800-900** |
| Waste (Abu Dhabi) | Municipality | **800-555** |
| HAZMAT | Civil Defence HAZMAT | **997** |
| Structural (Dubai) | Dubai Municipality Building Inspection | **+971 4 221 5555** |
| Heat-ban violation | MOHRE | MOHRE app / website |

**MOHRE Heat Ban:** outdoor work prohibited **12:30–15:00**, **15 June – 15 September**. Penalty: AED 5,000 per worker per violation.

---

*Document generated: June 2026 · supersedes `WAHATNA_HANDOVER.md`*
*Project: Wahatna — Al Qua'a Rural Safety Platform*
*Repository: Serena-SA/Wahatna-Rural-Area-Reporting*
