import type { TextStyle, ViewStyle } from "react-native";

/**
 * Shared visual language for the Wahatna app. These tokens centralize the
 * typography scale, corner radii, letter-spacing, line-heights, and shadow
 * recipes that were previously repeated inline across every screen.
 *
 * Values intentionally mirror the existing design 1:1 — referencing a token
 * must never change how a screen looks, only where the number lives.
 */

export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 16,
  xxl: 18,
  pill: 999,
} as const;

export const fontSize = {
  micro: 10,
  tiny: 11,
  caption: 12,
  small: 13,
  body: 14,
  bodyLg: 15,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 22,
  h3: 26,
  h2: 28,
  h1: 30,
  display: 32,
  giant: 52,
} as const;

export const fontWeight = {
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
} as const satisfies Record<string, TextStyle["fontWeight"]>;

export const tracking = {
  tighter: 0.2,
  tight: 0.3,
  normal: 0.5,
  snug: 0.6,
  wide: 1,
  wider: 1.5,
} as const;

export const lineHeight = {
  tight: 18,
  snug: 19,
  normal: 21,
  relaxed: 22,
  loose: 24,
} as const;

/**
 * Reusable text scales. Each preset combines size + weight + tracking +
 * line-height for a recurring semantic role. Spread into a StyleSheet entry
 * and add layout/color props as needed, e.g.
 *   sectionTitle: { ...typography.eyebrow, color: colors.mutedForeground }
 */
export const typography = {
  /** Uppercase section label: 11 / 700 / 1.5 tracking. */
  eyebrow: {
    fontSize: fontSize.tiny,
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.wider,
  },
} as const satisfies Record<string, TextStyle>;

/**
 * Warm shadow presets. `ctaGlow` is the green primary-button glow shared by the
 * login, register, and fleet "optimize" buttons.
 */
export const shadow = {
  ctaGlow: {
    shadowColor: "rgba(109,179,63,0.5)",
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const satisfies Record<string, ViewStyle>;
