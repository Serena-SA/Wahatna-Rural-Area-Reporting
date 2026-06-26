import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface OfflineBannerProps {
  isOnline: boolean;
  pendingCount?: number;
}

export function OfflineBanner({ isOnline, pendingCount = 0 }: OfflineBannerProps) {
  const translateY = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isOnline ? -50 : 0,
      useNativeDriver: true,
      damping: 20,
    }).start();
  }, [isOnline, translateY]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Feather name="wifi-off" size={14} color="#fff" />
      <Text style={styles.text}>
        Offline{pendingCount > 0 ? ` · ${pendingCount} report${pendingCount > 1 ? "s" : ""} queued` : ""}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: "#C65A3A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 8,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600" as const,
  },
});
