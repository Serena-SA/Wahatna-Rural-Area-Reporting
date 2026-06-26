import React from "react";
import { StyleSheet, Text, View } from "react-native";

type SeverityLevel = "green" | "amber" | "red" | "critical" | "low" | "medium" | "high";

const SEVERITY_MAP: Record<string, { label: string; bg: string; text: string; glow: string }> = {
  green: { label: "Green", bg: "rgba(109,179,63,0.18)", text: "#6DB33F", glow: "rgba(109,179,63,0.4)" },
  low: { label: "Low", bg: "rgba(109,179,63,0.18)", text: "#6DB33F", glow: "rgba(109,179,63,0.4)" },
  amber: { label: "Amber", bg: "rgba(201,138,26,0.18)", text: "#C98A1A", glow: "rgba(201,138,26,0.4)" },
  medium: { label: "Medium", bg: "rgba(201,138,26,0.18)", text: "#C98A1A", glow: "rgba(201,138,26,0.4)" },
  moderate: { label: "Moderate", bg: "rgba(201,138,26,0.18)", text: "#C98A1A", glow: "rgba(201,138,26,0.4)" },
  elevated: { label: "Elevated", bg: "rgba(199,122,42,0.18)", text: "#C77A2A", glow: "rgba(199,122,42,0.4)" },
  red: { label: "Red", bg: "rgba(198,90,58,0.18)", text: "#C65A3A", glow: "rgba(198,90,58,0.4)" },
  high: { label: "High", bg: "rgba(198,90,58,0.18)", text: "#C65A3A", glow: "rgba(198,90,58,0.4)" },
  critical: { label: "Critical", bg: "rgba(168,68,43,0.22)", text: "#A8442B", glow: "rgba(168,68,43,0.5)" },
};

interface SeverityBadgeProps {
  level: string;
  size?: "sm" | "md" | "lg";
}

export function SeverityBadge({ level, size = "md" }: SeverityBadgeProps) {
  const key = level.toLowerCase() as SeverityLevel;
  const config = SEVERITY_MAP[key] ?? SEVERITY_MAP.green;
  const fontSize = size === "sm" ? 10 : size === "lg" ? 14 : 11;
  const paddingH = size === "sm" ? 6 : size === "lg" ? 12 : 8;
  const paddingV = size === "sm" ? 2 : size === "lg" ? 5 : 3;

  return (
    <View style={[styles.badge, {
      backgroundColor: config.bg,
      borderColor: config.text,
      paddingHorizontal: paddingH,
      paddingVertical: paddingV,
      shadowColor: config.glow,
      shadowOpacity: 0.7,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
    }]}>
      <Text style={[styles.text, { color: config.text, fontSize }]}>
        {config.label.toUpperCase()}
      </Text>
    </View>
  );
}

export function severityGlowColor(level: string): string {
  const key = level.toLowerCase();
  return SEVERITY_MAP[key]?.glow ?? SEVERITY_MAP.green.glow;
}

export function severityTextColor(level: string): string {
  const key = level.toLowerCase();
  return SEVERITY_MAP[key]?.text ?? SEVERITY_MAP.green.text;
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "700" as const,
    letterSpacing: 0.6,
  },
});
