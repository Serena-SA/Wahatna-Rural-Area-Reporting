import React from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { WebView } from "react-native-webview";
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
}

export function RouteMap({
  points,
  route = [],
  height = 260,
  pinDropEnabled = false,
  pinMarker,
  initialCenter,
  onPinDrop,
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
  return (
    <View style={[styles.wrap, { height, borderColor: colors.border }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={[styles.webview, { backgroundColor: colors.background }]}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {
          if (!onPinDrop) return;
          try {
            const data = JSON.parse(event.nativeEvent.data) as { type: string; lat: number; lon: number };
            if (data.type === "pinDrop") onPinDrop(data.lat, data.lon);
          } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, overflow: "hidden", borderWidth: 1 },
  webview: { flex: 1 },
});
