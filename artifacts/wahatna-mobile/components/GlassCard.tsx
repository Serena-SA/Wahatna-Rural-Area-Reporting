import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme, type ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glowColor?: string;
  glowIntensity?: number;
  padding?: number;
}

export function GlassCard({ children, style, glowColor, padding = 16 }: GlassCardProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const isLight = scheme === "light";
  const borderColor = glowColor ?? colors.border;
  const warmShadow = glowColor ?? colors.glowWarm;

  if (Platform.OS !== "web") {
    return (
      <BlurView
        intensity={22}
        tint={isLight ? "light" : "dark"}
        style={[
          styles.base,
          {
            borderColor,
            padding,
            backgroundColor: isLight ? "rgba(251,245,230,0.65)" : "rgba(36,28,18,0.55)",
            shadowColor: warmShadow,
            shadowOpacity: 0.9,
            shadowRadius: glowColor ? 16 : 10,
            shadowOffset: { width: 0, height: 6 },
          },
          style,
        ]}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View
      style={[
        styles.base,
        {
          borderColor,
          padding,
          backgroundColor: colors.card,
          shadowColor: warmShadow,
          shadowOpacity: glowColor ? 0.4 : 0.9,
          shadowRadius: glowColor ? 16 : 10,
          shadowOffset: { width: 0, height: 6 },
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
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
});
