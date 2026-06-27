import React from "react";
import { StyleSheet, Text, View } from "react-native";

type SeverityKey =
  | "green"
  | "low"
  | "amber"
  | "medium"
  | "moderate"
  | "elevated"
  | "red"
  | "high"
  | "critical";

interface BadgeConfig {
  label: string;
  bg: string;
  text: string;
}

const SEVERITY_MAP: Record<string, BadgeConfig> = {
  green:    { label: "Low",      bg: "#F0FDF4", text: "#15803D" },
  low:      { label: "Low",      bg: "#F0FDF4", text: "#15803D" },
  amber:    { label: "Medium",   bg: "#FFFBEB", text: "#B45309" },
  medium:   { label: "Medium",   bg: "#FFFBEB", text: "#B45309" },
  moderate: { label: "Moderate", bg: "#FFFBEB", text: "#B45309" },
  elevated: { label: "Elevated", bg: "#FFF7ED", text: "#C2410C" },
  red:      { label: "High",     bg: "#FEF2F2", text: "#DC2626" },
  high:     { label: "High",     bg: "#FEF2F2", text: "#DC2626" },
  critical: { label: "Critical", bg: "#FFF1F2", text: "#9F1239" },
};

interface SeverityBadgeProps {
  level: string;
  size?: "sm" | "md" | "lg";
}

export function SeverityBadge({ level, size = "md" }: SeverityBadgeProps) {
  const key = level.toLowerCase() as SeverityKey;
  const config = SEVERITY_MAP[key] ?? SEVERITY_MAP["low"]!;
  const textSize = size === "sm" ? 10 : size === "lg" ? 13 : 11;
  const paddingH = size === "sm" ? 6 : size === "lg" ? 12 : 8;
  const paddingV = size === "sm" ? 2 : size === "lg" ? 4 : 3;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.text + "33",
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
      ]}
    >
      <Text style={[styles.text, { color: config.text, fontSize: textSize }]}>
        {config.label.toUpperCase()}
      </Text>
    </View>
  );
}

export function severityGlowColor(level: string): string {
  const config = SEVERITY_MAP[level.toLowerCase()];
  return config ? config.text + "22" : SEVERITY_MAP["low"]!.text + "22";
}

export function severityTextColor(level: string): string {
  const config = SEVERITY_MAP[level.toLowerCase()];
  return config ? config.text : SEVERITY_MAP["low"]!.text;
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "700" as const,
    letterSpacing: 0.4,
  },
});
