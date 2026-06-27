export interface MapPoint {
  id?: number;
  lat: number;
  lon: number;
  label: string;
  kind: "start" | "destination" | "stop";
  color?: string;
}

// Escape so embedded JSON can never break out of the inline <script> context
// (e.g. a place label containing "</script>" or HTML-comment sequences).
function safeJson(value: unknown): string {
  return JSON.stringify(value ?? [])
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export interface MapTheme {
  mode: "light" | "dark";
  background: string;
  labelBg: string;
  labelText: string;
  labelBorder: string;
  attributionBg: string;
  attributionText: string;
  markerStroke: string;
  start: string;
  destination: string;
  stop: string;
  route: string;
}

const DARK_THEME: MapTheme = {
  mode: "dark",
  background: "#1C1610",
  labelBg: "rgba(28,22,16,0.88)",
  labelText: "#F2EACC",
  labelBorder: "#3A2C1A",
  attributionBg: "rgba(28,22,16,0.6)",
  attributionText: "#A3916C",
  markerStroke: "#1C1610",
  start: "#6DB33F",
  destination: "#C98A1A",
  stop: "#A3916C",
  route: "#6DB33F",
};

interface MapPalette {
  background: string;
  card: string;
  border: string;
  text: string;
  mutedForeground: string;
  primary: string;
  accent: string;
  success: string;
}

/** Derive a Leaflet theme from the active color palette + scheme. */
export function mapThemeFromColors(c: MapPalette, mode: "light" | "dark"): MapTheme {
  return {
    mode,
    background: c.background,
    labelBg: c.card,
    labelText: c.text,
    labelBorder: c.border,
    attributionBg: c.card,
    attributionText: c.mutedForeground,
    markerStroke: c.background,
    start: c.success,
    destination: c.accent,
    stop: c.mutedForeground,
    route: c.primary,
  };
}

export interface MapPinDropOptions {
  pinDropEnabled?: boolean;
  pinMarker?: { lat: number; lon: number };
  initialCenter?: { lat: number; lon: number; zoom?: number };
}

export function buildMapHtml(
  points: MapPoint[],
  routeCoords: [number, number][],
  theme: MapTheme = DARK_THEME,
  pinOpts: MapPinDropOptions = {}
): string {
  const pts = safeJson(points ?? []);
  const route = safeJson(routeCoords ?? []);
  const tileUrl =
    theme.mode === "light"
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: ${theme.background}; }
  .lbl {
    background: ${theme.labelBg};
    color: ${theme.labelText};
    border: 1px solid ${theme.labelBorder};
    border-radius: 8px;
    padding: 2px 7px;
    font: 600 11px -apple-system, system-ui, sans-serif;
    white-space: nowrap;
    box-shadow: none;
  }
  .leaflet-tooltip-top:before, .leaflet-tooltip-bottom:before { display: none; }
  .leaflet-control-attribution { font-size: 9px; background: ${theme.attributionBg}; color: ${theme.attributionText}; }
  .leaflet-control-attribution a { color: ${theme.start}; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var points = ${pts};
  var route = ${route};
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([${pinOpts.initialCenter ? `${pinOpts.initialCenter.lat}, ${pinOpts.initialCenter.lon}` : "24.2, 54.4"}], ${pinOpts.initialCenter?.zoom ?? 7});
  L.tileLayer('${tileUrl}', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);

  function colorFor(k) {
    if (k === 'start') return '${theme.start}';
    if (k === 'destination') return '${theme.destination}';
    return '${theme.stop}';
  }

  if (route && route.length > 1) {
    L.polyline(route, { color: '${theme.route}', weight: 4, opacity: 0.85 }).addTo(map);
  }

  var bounds = [];
  points.forEach(function (p) {
    var c = p.color || colorFor(p.kind);
    var mk = L.circleMarker([p.lat, p.lon], {
      radius: 9, color: '${theme.markerStroke}', weight: 2, fillColor: c, fillOpacity: 1
    }).addTo(map).bindTooltip(p.label, {
      permanent: true, direction: 'top', className: 'lbl', offset: [0, -8]
    });
    if (p.id != null) {
      mk.on('click', function () {
        var _msg = JSON.stringify({ type: 'markerPress', id: p.id });
        if (typeof window !== 'undefined' && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(_msg);
        } else {
          try { window.parent.postMessage(_msg, '*'); } catch(_e) {}
        }
      });
    }
    bounds.push([p.lat, p.lon]);
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 12);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [44, 44], maxZoom: 14 });
  }
  ${pinOpts.pinDropEnabled ? `
  var _pinMk = null;
  ${pinOpts.pinMarker ? `_pinMk = L.circleMarker([${pinOpts.pinMarker.lat}, ${pinOpts.pinMarker.lon}], { radius: 13, color: '${theme.destination}', weight: 3, fillColor: '${theme.destination}', fillOpacity: 0.5 }).addTo(map);` : ""}
  map.getContainer().style.cursor = 'crosshair';
  map.on('click', function(e) {
    if (_pinMk) map.removeLayer(_pinMk);
    _pinMk = L.circleMarker([e.latlng.lat, e.latlng.lng], { radius: 13, color: '${theme.destination}', weight: 3, fillColor: '${theme.destination}', fillOpacity: 0.5 }).addTo(map);
    var _msg = JSON.stringify({ type: 'pinDrop', lat: e.latlng.lat, lon: e.latlng.lng });
    if (typeof window !== 'undefined' && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(_msg);
    } else {
      try { window.parent.postMessage(_msg, '*'); } catch(_e) {}
    }
  });
  ` : ""}
</script>
</body>
</html>`;
}
