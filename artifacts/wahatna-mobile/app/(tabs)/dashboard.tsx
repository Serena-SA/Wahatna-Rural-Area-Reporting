import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "@/components/GlassCard";
import { SeverityBadge, severityGlowColor } from "@/components/SeverityBadge";
import { apiGet } from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface Incident {
  id: number;
  title: string;
  description: string;
  status: string;
  severity: number;
  risk_level: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

interface DashboardData {
  active_incidents: Incident[];
  summary: {
    critical_count: number;
    high_count: number;
    medium_count: number;
    total_active: number;
  };
  heat_compliance: {
    ban_active: boolean;
    current_temp_c: number;
    risk_level: string;
  };
  leaderboard: Array<{ username: string; score: number; rank: number }>;
}

function severityToRisk(severity: number): string {
  if (severity >= 5) return "critical";
  if (severity >= 4) return "red";
  if (severity >= 3) return "amber";
  return "green";
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await apiGet<DashboardData>("/dashboard", token);
      setData(d);
      setError("");
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderIncident = useCallback(({ item }: { item: Incident }) => {
    const risk = item.risk_level || severityToRisk(item.severity);
    const glow = severityGlowColor(risk);
    return (
      <GlassCard glowColor={glow} style={styles.incidentCard} padding={14}>
        <View style={styles.incidentHeader}>
          <Text style={[styles.incidentTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          <SeverityBadge level={risk} size="sm" />
        </View>
        <Text style={[styles.incidentDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.incidentFooter}>
          <View style={styles.footerRow}>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {item.latitude != null ? item.latitude.toFixed(4) : "—"}, {item.longitude != null ? item.longitude.toFixed(4) : "—"}
            </Text>
          </View>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {new Date(item.created_at).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}
          </Text>
        </View>
      </GlassCard>
    );
  }, [colors]);

  const paddingBottom = insets.bottom + 80;
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={data?.active_incidents ?? []}
        keyExtractor={item => String(item.id)}
        renderItem={renderIncident}
        contentContainerStyle={{ padding: 16, paddingBottom, gap: 10, paddingTop: 8 }}
        scrollEnabled={!!(data?.active_incidents?.length)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {data?.heat_compliance && (
              <View style={[
                styles.heatBanner,
                {
                  backgroundColor: data.heat_compliance.ban_active ? colors.glowRed : colors.surface2,
                  borderColor: data.heat_compliance.ban_active ? colors.danger : colors.border,
                },
              ]}>
                <Feather
                  name={data.heat_compliance.ban_active ? "alert-triangle" : "sun"}
                  size={16}
                  color={data.heat_compliance.ban_active ? colors.danger : colors.primary}
                />
                <Text style={[styles.heatText, { color: data.heat_compliance.ban_active ? colors.danger : colors.primary }]}>
                  {data.heat_compliance.ban_active
                    ? `OUTDOOR BAN ACTIVE · ${data.heat_compliance.current_temp_c}°C`
                    : `Heat OK · ${data.heat_compliance.current_temp_c}°C`}
                </Text>
              </View>
            )}

            {data?.summary && (
              <View style={styles.summaryRow}>
                {[
                  { label: "Total", value: data.summary.total_active, color: colors.primary },
                  { label: "Critical", value: data.summary.critical_count, color: colors.danger },
                  { label: "High", value: data.summary.high_count, color: colors.warning },
                  { label: "Medium", value: data.summary.medium_count, color: colors.severityAmber },
                ].map(s => (
                  <GlassCard key={s.label} style={styles.summaryCard} padding={10}>
                    <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                  </GlassCard>
                ))}
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACTIVE INCIDENTS</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                <Pressable onPress={onRefresh}>
                  <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.empty}>
              <Feather name="check-circle" size={40} color={colors.success} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>All clear — no active incidents</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

import { Platform } from "react-native";

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  heatBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  heatText: { fontSize: 13, fontWeight: "700" as const, letterSpacing: 0.5 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 22, fontWeight: "800" as const },
  summaryLabel: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.5, marginBottom: 8 },
  incidentCard: { marginBottom: 2 },
  incidentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  incidentTitle: { fontSize: 15, fontWeight: "700" as const, flex: 1, marginRight: 8, letterSpacing: -0.2 },
  incidentDesc: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  incidentFooter: { flexDirection: "row", justifyContent: "space-between" },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 11 },
  empty: { alignItems: "center", paddingTop: 48, gap: 12 },
  emptyText: { fontSize: 14 },
  errorBox: { alignItems: "center", gap: 8, paddingVertical: 20 },
  errorText: { fontSize: 13 },
  retryText: { fontSize: 13, fontWeight: "600" as const },
});
