# Wahatna — AI hazard pipeline (YOLO + K2 Think V2)

_How a report photo becomes a triaged incident: local YOLO detection → K2 Think V2 reasoning → severity + government resolution ETA. Replaces the old `vision.ts` stub._

---

## 1. Where the K2 Think API key goes

**One place only:** `artifacts/api-server/.env`

```
K2THINK_API_KEY=your-key-here
```

- The server reads it via `process.env.K2THINK_API_KEY` (`artifacts/api-server/src/lib/k2think.ts`).
- `.env` is **gitignored** — the key is never committed. A documented placeholder lives in `.env.example`.
- Leave it blank to fall back to the local rule-based assessment (`agent.ts`); K2 activates automatically once a key is present.
- Optional overrides (rarely needed): `K2THINK_URL`, `K2THINK_MODEL` (default model `MBZUAI-IFM/K2-Think-v2`).

YOLO runs **locally** (on this machine, not a cloud service). K2 Think is the only external call.

---

## 2. The pipeline

```
photo ─▶ YOLO (local, best.pt)  ─▶ detections (labels + boxes)
                                       │
description + chosen category ─────────┼─▶ K2 Think V2 ─▶ { hazard_category, severity 1–5,
                                       │                    eta_hours, eta_text, reasoning,
                                       │                    recommended_action }
                                       ▼
                              incident created (status, dueAt = now + eta, detections stored)
```

- **YOLO detects** 5 classes from the trained model: `chemical hazard`, `fire`, `no helmet`, `smoke`, `water leak`.
- **K2 Think analyzes the detection output + the reporter's description** and selects the app hazard category (fire, flood, road_damage, electrical, heat_stress, waste, structural, other), rates severity, and estimates the government resolution time.
- **No detection?** The user's chosen category is used and K2 rates severity/ETA from the description alone (`analysis_source` = `user+k2`).
- **K2 unavailable** (no key / API error)? Falls back to the local rule-based agent (`...+local`). The app never blocks.
- **Offline?** Nothing runs on-device; the report is stored locally in the offline queue and the whole YOLO+K2 pipeline runs automatically on sync (the report just replays through `POST /api/report`).

### What the user sees (report screen)
1. **Scanning** — the photo with an animated scan line while YOLO runs.
2. **Bounding boxes** — drawn over the photo with class + confidence (or a "no hazard detected" note).
3. **"K2 Think V2 thinking…"** — an animated loader while K2 triages.
4. **Result** — hazard type, severity badge, estimated government resolution time, and "Analyzed by YOLO + K2 Think V2".

---

## 3. Running YOLO locally (Python + Ultralytics)

The trained model and a tiny inference service live in `artifacts/api-server/ml/`:

| File | Purpose |
|---|---|
| `best.pt` | the trained YOLO11n weights (from `train-2.zip`) |
| `detect_service.py` | loads the model once, serves `POST /detect` on `127.0.0.1:8099` |
| `requirements.txt` | `ultralytics` (pulls PyTorch) |
| `.venv/` | local virtualenv (gitignored) |

**First-time setup** (already done on this machine):
```powershell
cd artifacts\api-server\ml
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

**Run the detector** (the API calls it internally on port 8099):
```powershell
cd artifacts\api-server
.\ml\.venv\Scripts\python ml\detect_service.py
```
Health check: `GET http://127.0.0.1:8099/health`. The Node API reaches it via `YOLO_SERVICE_URL` (default `http://127.0.0.1:8099`). If the detector is down, detection returns "unavailable" and the pipeline falls back to the user's category — no crash.

---

## 4. Endpoints

- `POST /api/report/analyze` — multipart image → runs YOLO → `{ image_filename, detections, width, height }`. Creates no incident (stage 1, so the app can draw boxes first).
- `POST /api/report` — finalizes: accepts the `image_filename` + `detections` from analyze (online interactive path) **or** a fresh multipart image (offline-sync path, which re-runs YOLO server-side). Runs K2 Think, creates the incident, returns the assessment.

Detections are stored on the incident as normalized boxes (`detections` column, JSON), with `analysis_source` and `eta_text`. Seeded demo rows are now flagged with `is_seed=true` so **Clear demo data** never deletes real reports (which now carry a real YOLO confidence).

---

## 5. One-command demo (public link + QR)

```powershell
cd artifacts\wahatna-mobile
pnpm share          # or: pnpm share:rebuild   (after code changes)
```
`server/share.js` starts the YOLO detector, the API, serves the built web app, and opens a Cloudflare tunnel — printing a public `https://…trycloudflare.com` link and a scannable QR. Anyone can open it in a phone browser (no Wi-Fi, no Expo Go, no install). Keep the window open while sharing; the link changes on restart.

---

## 6. Files

**Added**
- `artifacts/api-server/ml/{best.pt, detect_service.py, requirements.txt}`
- `artifacts/api-server/src/lib/yolo.ts` — Node client for the detector
- `artifacts/api-server/src/lib/k2think.ts` — K2 Think V2 client
- `artifacts/wahatna-mobile/components/{DetectionOverlay,K2ThinkingLoader,AwarenessCards}.tsx`

**Changed**
- `artifacts/api-server/src/routes/report.ts` — `/analyze` + staged `/report`
- `artifacts/api-server/src/routes/supervisor.ts` — clear-demo now uses `is_seed`
- `artifacts/api-server/src/lib/{seed,serialize}.ts` — `is_seed`, new fields exposed
- `lib/db/src/schema/wahatna.ts` — `detections`, `analysis_source`, `eta_text`, `is_seed`
- `artifacts/wahatna-mobile/app/(tabs)/report.tsx` — staged YOLO→K2 visual flow
- `artifacts/wahatna-mobile/app/(tabs)/index.tsx` — awareness cards
- `artifacts/wahatna-mobile/constants/i18n.ts` — new strings ×4 languages
