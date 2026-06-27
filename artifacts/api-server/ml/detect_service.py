"""
detect_service.py — local YOLO hazard detector for Wahatna.

Loads the trained Ultralytics model (best.pt) ONCE and serves detections over a
tiny HTTP API so the Node API can call it per report without reloading the model.

  POST /detect   body: {"image_path": "C:/.../uploads/abc.jpg", "conf": 0.25}
                 -> {"ok": true, "width": W, "height": H,
                     "detections": [{"label": "smoke", "confidence": 0.82,
                                     "box": [x1,y1,x2,y2]}]}   # box normalised 0..1
  GET  /health   -> {"ok": true, "classes": [...]}

Run:  ml/.venv/Scripts/python.exe ml/detect_service.py   (port 8099 by default)
Env:  YOLO_PORT, YOLO_MODEL, YOLO_CONF
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.environ.get("YOLO_MODEL", os.path.join(HERE, "best.pt"))
PORT = int(os.environ.get("YOLO_PORT", "8099"))
DEFAULT_CONF = float(os.environ.get("YOLO_CONF", "0.25"))

print(f"[yolo] loading model: {MODEL_PATH}", flush=True)
from ultralytics import YOLO  # noqa: E402 (import after the log line)

model = YOLO(MODEL_PATH)
CLASS_NAMES = model.names if isinstance(model.names, dict) else {i: n for i, n in enumerate(model.names)}
print(f"[yolo] ready. classes: {list(CLASS_NAMES.values())}", flush=True)


def run_detection(image_path: str, conf: float):
    results = model.predict(source=image_path, conf=conf, verbose=False)
    out = []
    width = height = 0
    if results:
        r = results[0]
        height, width = (r.orig_shape if r.orig_shape else (0, 0))
        boxes = getattr(r, "boxes", None)
        if boxes is not None and width and height:
            for b in boxes:
                cls_id = int(b.cls.item())
                c = float(b.conf.item())
                x1, y1, x2, y2 = (float(v) for v in b.xyxy[0].tolist())
                out.append({
                    "label": CLASS_NAMES.get(cls_id, str(cls_id)),
                    "confidence": round(c, 4),
                    "box": [
                        round(x1 / width, 4), round(y1 / height, 4),
                        round(x2 / width, 4), round(y2 / height, 4),
                    ],
                })
    out.sort(key=lambda d: d["confidence"], reverse=True)
    return {"ok": True, "width": width, "height": height, "detections": out}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # quieter logs
        pass

    def do_GET(self):
        if self.path.startswith("/health"):
            self._send(200, {"ok": True, "classes": list(CLASS_NAMES.values())})
        else:
            self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if not self.path.startswith("/detect"):
            self._send(404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
            image_path = data.get("image_path")
            conf = float(data.get("conf", DEFAULT_CONF))
            if not image_path or not os.path.exists(image_path):
                self._send(400, {"ok": False, "error": "image_path missing or not found"})
                return
            self._send(200, run_detection(image_path, conf))
        except Exception as e:  # noqa: BLE001 — surface any inference error as JSON
            self._send(500, {"ok": False, "error": str(e)})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"[yolo] serving on http://127.0.0.1:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)
