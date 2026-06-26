import React from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
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
