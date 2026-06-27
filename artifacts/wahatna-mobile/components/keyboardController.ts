// Optional wrapper around react-native-keyboard-controller.
//
// That library ships a native module that the stock Expo Go app does NOT
// include, so importing it there throws at load time and red-screens the app.
// We load it defensively and fall back to no-ops, so the app still runs in
// Expo Go (keyboard avoidance is a polish nicety, not core to the flows).
// A real dev/EAS build has the native module and gets the full behaviour.

import type { ComponentType, ReactNode } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";

// In Expo Go the package may import cleanly but its native views/modules are
// absent, so the failure surfaces only when a component mounts (too late for a
// require() guard). Detect Expo Go up front and skip the native module entirely.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let lib: any = null;
if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require("react-native-keyboard-controller");
  } catch {
    lib = null;
  }
}

/** True when the native keyboard-controller module is actually available. */
export const hasKeyboardController: boolean = !!lib?.KeyboardProvider;

/** Wraps the app tree on a real build; a transparent pass-through in Expo Go. */
export const KeyboardProvider: ComponentType<{ children?: ReactNode }> =
  lib?.KeyboardProvider ?? (({ children }: { children?: ReactNode }) => children);

/** Present on a real build; null in Expo Go (caller falls back to ScrollView). */
export const KeyboardAwareScrollView: ComponentType<any> | null =
  lib?.KeyboardAwareScrollView ?? null;
