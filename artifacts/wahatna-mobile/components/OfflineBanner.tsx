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

  const label = pendingCount > 0
    ? `Offline · ${pendingCount} report${pendingCount > 1 ? "s" : ""} queued`
    : "Offline";

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <View style={styles.inner}>
        <Feather name="wifi-off" size={14} color="#92400E" />
        <Text style={styles.text}>{label}</Text>
      </View>
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
    backgroundColor: "#FEF3C7",
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 8,
  },
  text: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "600" as const,
  },
});
