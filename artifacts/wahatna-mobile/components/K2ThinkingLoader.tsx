import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

/**
 * Animated "K2 Think V2 thinking" indicator: a pulsing brain ring plus a row of
 * bouncing dots. Shown while the K2 Think assessment runs server-side.
 */
export function K2ThinkingLoader({ label, sublabel }: { label: string; sublabel?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    const dotLoops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    dotLoops.forEach((l) => l.start());
    return () => {
      pulseLoop.stop();
      dotLoops.forEach((l) => l.stop());
    };
  }, [pulse, dots]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

  return (
    <View style={styles.wrap}>
      <View style={styles.iconStack}>
        <Animated.View style={[styles.ring, { transform: [{ scale }], opacity: glow }]} />
        <View style={styles.iconCircle}>
          <Feather name="cpu" size={26} color="#fff" />
        </View>
      </View>

      <View style={styles.dotsRow}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
              },
            ]}
          />
        ))}
      </View>

      <Text style={styles.label}>{label}</Text>
      {!!sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
    </View>
  );
}

const ACCENT = "#7C3AED";

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 14, paddingVertical: 8 },
  iconStack: { width: 76, height: 76, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: ACCENT,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: { flexDirection: "row", gap: 8, height: 12, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  label: { fontSize: 15, fontWeight: "800" as const, color: ACCENT, letterSpacing: 0.3 },
  sublabel: { fontSize: 12.5, color: "#6B7280", textAlign: "center", lineHeight: 18, paddingHorizontal: 24 },
});
