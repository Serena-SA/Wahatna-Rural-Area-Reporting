/**
 * share.js — one-command public web demo.
 *
 * Serves the exported web app (./dist) AND proxies the API on a single origin,
 * then opens a free Cloudflare tunnel so anyone can scan a QR and open the app
 * in a phone browser — no Wi-Fi, no Expo Go, no install on their side.
 *
 *   node server/share.js          # build web if needed, start API if needed, tunnel
 *   node server/share.js --build  # force a fresh web build first
 *
 * The web app is built with EXPO_PUBLIC_API_URL unset so it talks to its own
 * origin (see constants/env.ts) — that's why one tunnel can serve app + API.
 * Requires cloudflared installed. Keep the window open while sharing the link.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const API_DIR = path.resolve(PROJECT_ROOT, "..", "api-server");
const DIST = path.join(PROJECT_ROOT, "dist");
const PORT = parseInt(process.env.SHARE_PORT || "8090", 10);
const API_PORT = parseInt(process.env.API_PORT || "8080", 10);
const YOLO_PORT = parseInt(process.env.YOLO_PORT || "8099", 10);
const API_TARGET = process.env.API_TARGET || `http://127.0.0.1:${API_PORT}`;
const CLOUDFLARED =
  process.env.CLOUDFLARED_BIN ||
  [
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
  ].find((p) => fs.existsSync(p)) ||
  "cloudflared";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

const apiUrl = new URL(API_TARGET);

// ── helpers ────────────────────────────────────────────────────────────────

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port }, () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.setTimeout(1500, () => {
      s.destroy();
      resolve(false);
    });
  });
}

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function buildWeb() {
  console.log("[share] building web app (this takes ~30-60s)...");
  await run("node", ["node_modules/expo/bin/cli", "export", "--platform", "web", "--output-dir", "dist"], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, EXPO_PUBLIC_API_URL: "" }, // origin-relative web build
  });
}

async function ensureYolo() {
  if (await portOpen(YOLO_PORT)) {
    console.log(`[share] YOLO detector already running on :${YOLO_PORT}`);
    return;
  }
  const py = path.join(API_DIR, "ml", ".venv", "Scripts", "python.exe");
  const script = path.join(API_DIR, "ml", "detect_service.py");
  if (!fs.existsSync(py) || !fs.existsSync(script)) {
    console.warn(
      "[share] YOLO detector not set up (ml/.venv missing) — reports still work, " +
        "but without bounding boxes. See ml/requirements.txt to enable it.",
    );
    return;
  }
  console.log("[share] starting YOLO detector (loads the model, ~10-20s)...");
  const yolo = spawn(py, [script], { cwd: path.join(API_DIR, "ml"), stdio: "ignore", detached: false });
  yolo.on("error", (e) => console.warn(`[share] YOLO start error: ${e.message}`));
  for (let i = 0; i < 70; i++) {
    if (await portOpen(YOLO_PORT)) {
      console.log("[share] YOLO detector is up.");
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn("[share] YOLO detector didn't come up in time — boxes may be unavailable.");
}

async function ensureApi() {
  if (await portOpen(API_PORT)) {
    console.log(`[share] API already running on :${API_PORT}`);
    return;
  }
  const entry = path.join(API_DIR, "dist", "index.mjs");
  const envFile = path.join(API_DIR, ".env");
  if (!fs.existsSync(entry) || !fs.existsSync(envFile)) {
    console.warn(
      `[share] API not running on :${API_PORT} and can't auto-start ` +
        `(missing ${fs.existsSync(entry) ? ".env" : "dist/index.mjs"}). ` +
        `Start it yourself, then reload the link.`,
    );
    return;
  }
  console.log(`[share] starting API on :${API_PORT}...`);
  const api = spawn("node", ["--env-file=.env", "--enable-source-maps", "./dist/index.mjs"], {
    cwd: API_DIR,
    stdio: "ignore",
    detached: false,
  });
  api.on("error", (e) => console.warn(`[share] API start error: ${e.message}`));
  for (let i = 0; i < 20; i++) {
    if (await portOpen(API_PORT)) {
      console.log("[share] API is up.");
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn("[share] API didn't come up in time — the link may show errors until it does.");
}

// ── static + API proxy on one origin ────────────────────────────────────────

function proxyToApi(req, res) {
  const upstream = http.request(
    {
      protocol: apiUrl.protocol,
      hostname: apiUrl.hostname,
      port: apiUrl.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: apiUrl.host },
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `API unreachable: ${err.message}` }));
  });
  req.pipe(upstream);
}

function serveStatic(pathname, res) {
  const safe = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = path.join(DIST, safe);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  // SPA fallback: unknown, extension-less routes -> index.html (client routing).
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (path.extname(filePath)) {
      res.writeHead(404);
      return res.end("Not Found");
    }
    filePath = path.join(DIST, "index.html");
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const pathname = (req.url || "/").split("?")[0];
  if (pathname === "/api" || pathname.startsWith("/api/") || pathname.startsWith("/uploads/")) {
    return proxyToApi(req, res);
  }
  serveStatic(pathname, res);
});

// ── tunnel + QR ─────────────────────────────────────────────────────────────

function showQr(url) {
  try {
    const qrcode = require("qrcode-terminal");
    qrcode.generate(url, { small: true }, (qr) => console.log("\n" + qr));
  } catch {
    /* optional */
  }
}

function banner(url) {
  const line = "═".repeat(Math.max(url.length + 6, 46));
  console.log(`\n╔${line}╗`);
  console.log(`║  PUBLIC LINK — scan or share this:`.padEnd(line.length + 1) + "║");
  console.log(`║  ${url}`.padEnd(line.length + 1) + "║");
  console.log(`╚${line}╝`);
  showQr(url);
  console.log("\n[share] Keep this window open — the link works only while this is running.\n");
}

function startTunnel() {
  console.log(`[share] opening Cloudflare tunnel via: ${CLOUDFLARED}`);
  const cf = spawn(CLOUDFLARED, ["tunnel", "--url", `http://localhost:${PORT}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let shown = false;
  const scan = (buf) => {
    const m = buf.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (m && !shown) {
      shown = true;
      banner(m[0]);
    }
  };
  cf.stdout.on("data", scan);
  cf.stderr.on("data", scan);
  cf.on("error", (err) => {
    console.error(`[share] failed to start cloudflared: ${err.message}`);
    console.error("[share] install it (winget install Cloudflare.cloudflared) or set CLOUDFLARED_BIN.");
  });
  cf.on("exit", (code) => {
    console.log(`[share] cloudflared exited (${code}); link is down.`);
    process.exit(code || 0);
  });
  const stop = () => {
    cf.kill();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const forceBuild = process.argv.includes("--build");
  if (forceBuild || !fs.existsSync(path.join(DIST, "index.html"))) {
    await buildWeb();
  } else {
    console.log("[share] using existing web build in ./dist (pass --build to rebuild)");
  }
  await ensureYolo();
  await ensureApi();
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[share] serving web build + API proxy on http://localhost:${PORT}`);
    startTunnel();
  });
}

main().catch((err) => {
  console.error(`[share] ${err.message}`);
  process.exit(1);
});
