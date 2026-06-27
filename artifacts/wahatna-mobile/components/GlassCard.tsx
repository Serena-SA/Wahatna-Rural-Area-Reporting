import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Optional accent border/shadow color. Defaults to colors.border. */
  glowColor?: string;
  /** Unused — kept for API compatibility */
  glowIntensity?: number;
  padding?: number;
}

export function GlassCard({
  children,
  style,
  glowColor,
  padding = 16,
}: GlassCardProps) {
  const colors = useColors();
  const borderColor = glowColor ?? colors.border;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.card,
          borderColor,
          padding,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
});
