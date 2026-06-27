import colors from "@/constants/colors";

/**
 * Returns the light design tokens.
 * Wahatna uses a fixed light theme regardless of system color scheme.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
