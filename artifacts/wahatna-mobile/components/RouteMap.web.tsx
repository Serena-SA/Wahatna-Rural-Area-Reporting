import React, { useEffect, useRef } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { buildMapHtml, mapThemeFromColors, type MapPoint, type MapPinDropOptions } from "@/constants/mapHtml";
import { useColors } from "@/hooks/useColors";

interface RouteMapProps {
  points: MapPoint[];
  route?: [number, number][];
  height?: number;
  pinDropEnabled?: boolean;
  pinMarker?: { lat: number; lon: number };
  initialCenter?: { lat: number; lon: number; zoom?: number };
  onPinDrop?: (lat: number, lon: number) => void;
  onMarkerPress?: (id: number) => void;
}

export function RouteMap({
  points,
  route = [],
  height = 260,
  pinDropEnabled = false,
  pinMarker,
  initialCenter,
  onPinDrop,
  onMarkerPress,
}: RouteMapProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const pinOpts: MapPinDropOptions = { pinDropEnabled, pinMarker, initialCenter };
  const html = buildMapHtml(
    points,
    route,
    mapThemeFromColors(colors, scheme === "light" ? "light" : "dark"),
    pinOpts
  );

  useEffect(() => {
    if (!onPinDrop && !onMarkerPress) return;
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data)) as { type: string; lat: number; lon: number; id?: number };
        if (data.type === "pinDrop" && onPinDrop) onPinDrop(data.lat, data.lon);
        if (data.type === "markerPress" && onMarkerPress && data.id != null) onMarkerPress(data.id);
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pinDropEnabled, onPinDrop, onMarkerPress]);

  return (
    <View style={[styles.wrap, { height, borderColor: colors.border }]}>
      <iframe
        srcDoc={html}
        title="Route map"
        sandbox="allow-scripts"
        style={{ border: "none", width: "100%", height: "100%", display: "block" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, overflow: "hidden", borderWidth: 1 },
});
