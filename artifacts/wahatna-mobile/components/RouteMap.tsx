import React from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { WebView } from "react-native-webview";
import { buildMapHtml, mapThemeFromColors, type MapPoint } from "@/constants/mapHtml";
import { useColors } from "@/hooks/useColors";

interface RouteMapProps {
  points: MapPoint[];
  route?: [number, number][];
  height?: number;
}

export function RouteMap({ points, route = [], height = 260 }: RouteMapProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const html = buildMapHtml(points, route, mapThemeFromColors(colors, scheme === "light" ? "light" : "dark"));
  return (
    <View style={[styles.wrap, { height, borderColor: colors.border }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={[styles.webview, { backgroundColor: colors.background }]}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, overflow: "hidden", borderWidth: 1 },
  webview: { flex: 1 },
});
