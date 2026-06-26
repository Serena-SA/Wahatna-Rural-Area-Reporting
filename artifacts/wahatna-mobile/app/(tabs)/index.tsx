import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "@/components/GlassCard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { apiGet } from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useOfflineQueue, type QueueItem } from "@/context/OfflineQueueContext";
import { useNetworkState } from "@/hooks/useNetworkState";
import { useColors } from "@/hooks/useColors";

interface DashboardData {
  summary: { critical_count: number; total_active: number };
  heat_compliance: { ban_active: boolean; current_temp_c: number; risk_level: string };
  leaderboard: Array<{ username: string; score: number; rank: number }>;
}

async function registerPushToken(token: string) {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const pushToken = await Notifications.getExpoPushTokenAsync();
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const base = domain ? `https://${domain}/api` : "http://localhost:8080/api";
    await fetch(`${base}/worker/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ push_token: pushToken.data }),
    });
  } catch {}
}

async function syncWorkerLocation(token: string, lat: number, lon: number) {
  try {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const base = domain ? `https://${domain}/api` : "http://localhost:8080/api";
    await fetch(`${base}/worker/location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lat, lon }),
    });
  } catch {}
}

function AnimatedCounter({ value, color }: { value: number; color: string }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(animVal, { toValue: value, duration: 1000, useNativeDriver: false }).start();
    const id = animVal.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => animVal.removeListener(id);
  }, [value, animVal]);

  return <Text style={[styles.bigNumber, { color }]}>{display}</Text>;
}

const STATUS_CONFIG: Record<string, { icon: "clock" | "refresh-cw" | "check-circle" | "alert-circle"; color: string; label: string }> = {
  pending: { icon: "clock", color: "#C98A1A", label: "Queued" },
  syncing: { icon: "refresh-cw", color: "#6CA5A0", label: "Syncing" },
  synced: { icon: "check-circle", color: "#6DB33F", label: "Synced" },
  failed: { icon: "alert-circle", color: "#C65A3A", label: "Failed" },
};

function QueueItemRow({ item }: { item: QueueItem }) {
  const colors = useColors();
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  return (
    <View style={[styles.queueItemRow, { borderColor: colors.border }]}>
      <Feather name={cfg.icon} size={14} color={cfg.color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.queueItemText, { color: colors.text }]} numberOfLines={1}>
          {item.payload.category.replace("_", " ")} — {item.payload.reportText.slice(0, 40)}…
        </Text>
        <Text style={[styles.queueItemTime, { color: colors.mutedForeground }]}>
          {new Date(item.createdAt).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: `${cfg.color}22` }]}>
        <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user, logout } = useAuth();
  const { lastLocation, isTracking, startTracking, stopTracking } = useLocation();
  const { pendingCount, queue, retryAll, clearSynced } = useOfflineQueue();
  const { isOnline } = useNetworkState();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [shiftActive, setShiftActive] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const lastSyncRef = useRef(0);

  const pulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (shiftActive) pulse();
    else pulseAnim.stopAnimation();
  }, [shiftActive, pulse, pulseAnim]);

  useEffect(() => {
    if (!token) return;
    registerPushToken(token);
    apiGet<DashboardData>("/dashboard", token).then(d => setDashboard(d)).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !shiftActive || !lastLocation) return;
    const now = Date.now();
    if (now - lastSyncRef.current < 30000) return;
    lastSyncRef.current = now;
    syncWorkerLocation(token, lastLocation.lat, lastLocation.lon);
  }, [token, shiftActive, lastLocation]);

  const toggleShift = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (shiftActive) {
      await stopTracking();
      setShiftActive(false);
    } else {
      await startTracking();
      setShiftActive(true);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 80);

  const heatBan = dashboard?.heat_compliance?.ban_active ?? false;
  const tempC = dashboard?.heat_compliance?.current_temp_c ?? "--";
  const score = user?.score ?? 0;
  const streak = user?.streak_days ?? 0;
  const leaderboard = dashboard?.leaderboard ?? [];

  const onlineColor = isOnline ? colors.success : colors.danger;
  const hasQueueItems = queue.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />

      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: bottomPad, paddingHorizontal: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Welcome back,</Text>
            <Text style={[styles.username, { color: colors.text }]}>{user?.username ?? "Field Worker"}</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.onlinePill, { backgroundColor: isOnline ? colors.glowGreen : colors.glowRed, borderColor: onlineColor }]}>
              <Animated.View style={[styles.onlineDot, { backgroundColor: onlineColor, transform: [{ scale: isOnline ? pulseAnim : 1 }] }]} />
              <Text style={[styles.onlineText, { color: onlineColor }]}>{isOnline ? "Online" : "Offline"}</Text>
            </View>
            <Pressable onPress={logout} style={[styles.logoutBtn, { borderColor: colors.border }]}>
              <Feather name="log-out" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        {/* Shift Toggle */}
        <Pressable onPress={toggleShift}>
          <LinearGradient
            colors={shiftActive ? ["#6DB33F", "#4E8B2C"] : [colors.surface, colors.surface2]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.shiftCard, { borderColor: shiftActive ? "#6DB33F" : colors.border }]}
          >
            <Animated.View style={{ transform: [{ scale: shiftActive ? pulseAnim : 1 }] }}>
              <Feather name={shiftActive ? "radio" : "power"} size={24} color={shiftActive ? "#14100A" : colors.mutedForeground} />
            </Animated.View>
            <View>
              <Text style={[styles.shiftLabel, { color: shiftActive ? "#14100A" : colors.mutedForeground }]}>
                {shiftActive ? "SHIFT ACTIVE" : "START SHIFT"}
              </Text>
              {shiftActive && lastLocation && (
                <Text style={[styles.shiftCoords, { color: "rgba(20,16,10,0.7)" }]}>
                  {lastLocation.lat.toFixed(4)}, {lastLocation.lon.toFixed(4)}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }} />
            <View style={[styles.shiftStatus, { backgroundColor: shiftActive ? "rgba(20,16,10,0.2)" : colors.surface2 }]}>
              <Text style={[styles.shiftStatusText, { color: shiftActive ? "#14100A" : colors.mutedForeground }]}>
                {shiftActive ? "Tap to stop" : "Tap to start"}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Score + Stats */}
        <GlassCard glowColor={colors.glowAmber} padding={20}>
          <View style={styles.scoreSection}>
            <View style={styles.scoreLeft}>
              <Text style={[styles.scoreTitle, { color: colors.mutedForeground }]}>HAZARD SCORE</Text>
              <AnimatedCounter value={score} color={colors.primary} />
              <Text style={[styles.scorePoints, { color: colors.mutedForeground }]}>pts</Text>
            </View>
            <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statsRight}>
              <View style={styles.statRow}>
                <View style={[styles.statIcon, { backgroundColor: colors.glowAmber }]}>
                  <Feather name="zap" size={14} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{streak}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Day streak</Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={[styles.statIcon, { backgroundColor: colors.glowRed }]}>
                  <Feather name="alert-triangle" size={14} color={colors.danger} />
                </View>
                <View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{dashboard?.summary?.total_active ?? "--"}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active incidents</Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={[styles.statIcon, { backgroundColor: colors.glowRed }]}>
                  <Feather name="alert-octagon" size={14} color={colors.danger} />
                </View>
                <View>
                  <Text style={[styles.statValue, { color: colors.danger }]}>{dashboard?.summary?.critical_count ?? "--"}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Critical</Text>
                </View>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* Heat Compliance */}
        {dashboard?.heat_compliance && (
          <GlassCard glowColor={heatBan ? colors.glowRed : colors.glowGreen} padding={14}>
            <View style={styles.heatRow}>
              <View style={[styles.heatIcon, { backgroundColor: heatBan ? colors.glowRed : colors.glowGreen }]}>
                <Feather name={heatBan ? "alert-triangle" : "sun"} size={18} color={heatBan ? colors.danger : colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heatTitle, { color: heatBan ? colors.danger : colors.success }]}>
                  {heatBan ? "OUTDOOR WORK BAN" : "HEAT STATUS: OK"}
                </Text>
                <Text style={[styles.heatTemp, { color: colors.mutedForeground }]}>
                  Current: {tempC}°C · {dashboard.heat_compliance.risk_level}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Offline Queue — per-item status */}
        {hasQueueItems && (
          <GlassCard padding={14} glowColor={pendingCount > 0 ? colors.glowAmber : undefined}>
            <Pressable onPress={() => setShowQueue(v => !v)} style={styles.queueHeader}>
              <View style={styles.queueHeaderLeft}>
                <Feather name="layers" size={15} color={pendingCount > 0 ? colors.warning : colors.success} />
                <Text style={[styles.queueTitle, { color: pendingCount > 0 ? colors.warning : colors.success }]}>
                  Report Queue
                </Text>
                <View style={[styles.queueBadge, { backgroundColor: pendingCount > 0 ? colors.glowAmber : colors.glowGreen }]}>
                  <Text style={[styles.queueBadgeText, { color: pendingCount > 0 ? colors.warning : colors.success }]}>
                    {pendingCount > 0 ? `${pendingCount} pending` : "All synced"}
                  </Text>
                </View>
              </View>
              <View style={styles.queueHeaderRight}>
                {isOnline && pendingCount > 0 && (
                  <Pressable
                    onPress={() => token && retryAll(token)}
                    style={[styles.retryBtn, { borderColor: colors.primary }]}
                  >
                    <Feather name="refresh-cw" size={12} color={colors.primary} />
                  </Pressable>
                )}
                {queue.filter(i => i.status === "synced").length > 0 && (
                  <Pressable onPress={clearSynced} style={[styles.retryBtn, { borderColor: colors.border }]}>
                    <Feather name="trash-2" size={12} color={colors.mutedForeground} />
                  </Pressable>
                )}
                <Feather name={showQueue ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </View>
            </Pressable>

            {showQueue && (
              <View style={[styles.queueList, { borderTopColor: colors.border }]}>
                {queue.map(item => <QueueItemRow key={item.id} item={item} />)}
              </View>
            )}
          </GlassCard>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>LEADERBOARD</Text>
            {leaderboard.slice(0, 5).map((entry, i) => (
              <GlassCard key={entry.username} padding={12} style={entry.username === user?.username ? { borderColor: colors.primary } : undefined}>
                <View style={styles.leaderRow}>
                  <Text style={[styles.leaderRank, { color: i === 0 ? colors.primary : colors.mutedForeground }]}>
                    #{i + 1}
                  </Text>
                  <Text style={[styles.leaderName, { color: entry.username === user?.username ? colors.primary : colors.text }]}>
                    {entry.username}
                    {entry.username === user?.username && " (you)"}
                  </Text>
                  <Text style={[styles.leaderScore, { color: colors.primary }]}>{entry.score}</Text>
                  <Feather name="star" size={12} color={colors.primary} />
                </View>
              </GlassCard>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 12, fontWeight: "500" as const, letterSpacing: 0.2 },
  username: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.3, lineHeight: 28 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  onlinePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { fontSize: 11, fontWeight: "700" as const },
  logoutBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  shiftCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 18,
  },
  shiftLabel: { fontSize: 13, fontWeight: "800" as const, letterSpacing: 1 },
  shiftCoords: { fontSize: 10, marginTop: 2 },
  shiftStatus: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  shiftStatusText: { fontSize: 11, fontWeight: "600" as const },
  scoreSection: { flexDirection: "row", alignItems: "center" },
  scoreLeft: { alignItems: "center", paddingRight: 20 },
  scoreTitle: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 4 },
  bigNumber: { fontSize: 52, fontWeight: "900" as const, lineHeight: 60 },
  scorePoints: { fontSize: 12 },
  scoreDivider: { width: 1, height: 80, marginRight: 20 },
  statsRight: { flex: 1, gap: 12 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 18, fontWeight: "800" as const, lineHeight: 22 },
  statLabel: { fontSize: 10 },
  heatRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heatIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  heatTitle: { fontSize: 13, fontWeight: "700" as const, letterSpacing: 0.5 },
  heatTemp: { fontSize: 11, marginTop: 2 },
  queueHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  queueHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  queueTitle: { fontSize: 13, fontWeight: "700" as const },
  queueBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  queueBadgeText: { fontSize: 10, fontWeight: "700" as const },
  queueHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  retryBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  queueList: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, gap: 8 },
  queueItemRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingBottom: 8, borderBottomWidth: 1,
  },
  queueItemText: { fontSize: 12, fontWeight: "500" as const },
  queueItemTime: { fontSize: 10, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: "700" as const },
  sectionTitle: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.5 },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  leaderRank: { fontSize: 14, fontWeight: "700" as const, width: 28 },
  leaderName: { flex: 1, fontSize: 14, fontWeight: "600" as const },
  leaderScore: { fontSize: 14, fontWeight: "800" as const },
});
