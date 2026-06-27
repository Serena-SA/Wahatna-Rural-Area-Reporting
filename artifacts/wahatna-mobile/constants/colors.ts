/**
 * Wahatna — UAE oasis light theme palette.
 * A single light palette is used; dark values are kept for reference only.
 * useColors always returns the light palette regardless of system setting.
 */

const light = {
  background: "#F5F2EC",   // warm sand
  card: "#FFFFFF",
  cardForeground: "#1A1A1A",
  foreground: "#1A1A1A",
  text: "#1A1A1A",
  tint: "#2D7A3A",
  primary: "#2D7A3A",      // UAE forest green
  primaryForeground: "#FFFFFF",
  secondary: "#E8F5E9",
  secondaryForeground: "#1A1A1A",
  muted: "#F0EDE6",
  mutedForeground: "#6B7280",
  accent: "#B45309",
  accentForeground: "#FFFFFF",
  destructive: "#DC2626",
  destructiveForeground: "#FFFFFF",
  border: "#E5E0D8",
  input: "#E5E0D8",
  surface: "#FFFFFF",
  surface2: "#F0EDE6",
  danger: "#DC2626",
  warning: "#B45309",
  success: "#2D7A3A",
  // glow helpers (kept for badge compatibility)
  glowAmber: "rgba(180,83,9,0.12)",
  glowRed: "rgba(220,38,38,0.12)",
  glowGreen: "rgba(45,122,58,0.12)",
  glowOrange: "rgba(180,83,9,0.12)",
  glowWarm: "rgba(107,114,128,0.08)",
  // severity
  severityGreen: "#2D7A3A",
  severityAmber: "#B45309",
  severityRed: "#DC2626",
  severityCritical: "#991B1B",
};

// Dark values kept for reference; useColors does NOT use them.
const dark = {
  background: "#1C1610",
  card: "#241C12",
  cardForeground: "#F2EACC",
  foreground: "#F2EACC",
  text: "#F2EACC",
  tint: "#6DB33F",
  primary: "#6DB33F",
  primaryForeground: "#14100A",
  secondary: "#2E2215",
  secondaryForeground: "#D8C9A0",
  muted: "#2E2215",
  mutedForeground: "#A3916C",
  accent: "#C98A1A",
  accentForeground: "#14100A",
  destructive: "#C65A3A",
  destructiveForeground: "#FFFFFF",
  border: "#3A2C1A",
  input: "#3A2C1A",
  surface: "#241C12",
  surface2: "#2E2215",
  danger: "#C65A3A",
  warning: "#C98A1A",
  success: "#6DB33F",
  glowAmber: "rgba(201,138,26,0.20)",
  glowRed: "rgba(198,90,58,0.22)",
  glowGreen: "rgba(109,179,63,0.22)",
  glowOrange: "rgba(201,138,26,0.20)",
  glowWarm: "rgba(195,155,80,0.15)",
  severityGreen: "#6DB33F",
  severityAmber: "#C98A1A",
  severityRed: "#C65A3A",
  severityCritical: "#A8442B",
};

const colors = {
  light,
  dark,
  radius: 16,
};

export default colors;
