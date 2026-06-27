import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "@/components/GlassCard";
import { SeverityBadge } from "@/components/SeverityBadge";
import { apiGet } from "@/constants/api";
import { LANGUAGE_OPTIONS, type Language } from "@/constants/i18n";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useOfflineQueue } from "@/context/OfflineQueueContext";
import { useNetworkState } from "@/hooks/useNetworkState";
import { useColors } from "@/hooks/useColors";

// ─── types ──────────────────────────────────────────────────────────────────

interface Report {
  id: number;
  reference: string;
  category?: string;
  threat_class: string | null;
  status: string;
  severity_label: string;
  risk_level: string;
  created_at: string | null;
}

interface HeatCompliance {
  ban_active: boolean;
  current_temp_c: number;
  risk_level: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, "thermometer" | "navigation" | "trash-2" | "droplet" | "alert-triangle" | "zap" | "home" | "more-horizontal"> = {
  heat_stress: "thermometer",
  road_damage: "navigation",
  waste: "trash-2",
  flood: "droplet",
  fire: "alert-triangle",
  electrical: "zap",
  structural: "home",
  other: "more-horizontal",
};

function categoryIcon(cat: string | null | undefined) {
  if (!cat) return "alert-triangle";
  return CATEGORY_ICONS[cat] ?? "alert-triangle";
}

function formatDate(iso: string | null, isRTL: boolean): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(isRTL ? "ar-AE" : "en-AE", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending_review: "#6B7280",
  under_review: "#2563EB",
  assigned: "#D97706",
  completed: "#16A34A",
  rejected: "#DC2626",
  late: "#EA580C",
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#6B7280";
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user, logout } = useAuth();
  const { t, language, setLanguage, isRTL } = useTranslation();
  const { pendingCount, retryAll } = useOfflineQueue();
  const { isOnline } = useNetworkState();

  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [heatCompliance, setHeatCompliance] = useState<HeatCompliance | null>(null);
  const [loadingReports, setLoadingReports] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const dir = isRTL ? "rtl" : "ltr";
  const row: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
  const align: "flex-start" | "flex-end" = isRTL ? "flex-end" : "flex-start";
  const textAlign: "left" | "right" = isRTL ? "right" : "left";

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 80);

  const loadData = async () => {
    if (!token) return;
    try {
      const [reportsData, dashData] = await Promise.allSettled([
        apiGet<{ reports: Report[] }>("/reports/my", token),
        apiGet<{ heat_compliance: HeatCompliance }>("/dashboard", token),
      ]);
      if (reportsData.status === "fulfilled") {
        setRecentReports(reportsData.value.reports.slice(0, 3));
      }
      if (dashData.status === "fulfilled") {
        setHeatCompliance(dashData.value.heat_compliance ?? null);
      }
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const greeting = `${t("home_greeting")}, ${user?.username ?? ""}`;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: bottomPad,
          paddingHorizontal: 16,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Header ────────────────────────────────────────── */}
        <View style={[styles.headerRow, { flexDirection: row }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.mutedForeground, textAlign }]}>
              {greeting}
            </Text>
            <Text style={[styles.appName, { color: colors.text, textAlign }]}>WAHATNA</Text>
          </View>
          <Pressable
            onPress={logout}
            style={[styles.logoutBtn, { borderColor: colors.border }]}
          >
            <Feather name="log-out" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* ── Offline chip ──────────────────────────────────── */}
        {pendingCount > 0 && (
          <Pressable
            onPress={() => token && retryAll(token)}
            style={[
              styles.offlineChip,
              { flexDirection: row, backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
            ]}
          >
            <Feather name="wifi-off" size={14} color="#B45309" />
            <Text style={[styles.offlineChipText, { color: "#B45309" }]}>
              {pendingCount} {t("home_queued_offline")} · {t("report_submit")}
            </Text>
          </Pressable>
        )}

        {/* ── Report Hazard CTA ─────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push("/(tabs)/report")}
        >
          <View style={[styles.ctaInner, { flexDirection: row }]}>
            <Feather name="alert-triangle" size={22} color={colors.primaryForeground} />
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
              {t("home_report_cta")}
            </Text>
          </View>
        </Pressable>

        {/* ── Heat ban card ─────────────────────────────────── */}
        {heatCompliance?.ban_active && (
          <GlassCard padding={14}>
            <View style={[styles.heatRow, { flexDirection: row }]}>
              <View style={[styles.heatIcon, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="sun" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={[styles.heatTitle, { color: "#D97706", textAlign }]}>
                  {t("home_heat_ban_title")}
                </Text>
                <Text style={[styles.heatBody, { color: colors.mutedForeground, textAlign }]}>
                  {t("home_heat_ban_body")}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* ── Recent reports strip ──────────────────────────── */}
        <View>
          <View style={[styles.sectionHeader, { flexDirection: row }]}>
            <Text style={[styles.sectionTitle, { color: colors.text, textAlign }]}>
              {t("home_my_reports")}
            </Text>
            <Pressable onPress={() => router.push("/(tabs)/my-reports")}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>{t("home_view_all")}</Text>
            </Pressable>
          </View>

          {loadingReports ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          ) : recentReports.length === 0 ? (
            <GlassCard padding={20}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>
                {t("home_no_reports_yet")}
              </Text>
            </GlassCard>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll}>
              <View style={[styles.stripRow, { flexDirection: row }]}>
                {recentReports.map(report => (
                  <Pressable
                    key={report.id}
                    onPress={() => router.push("/(tabs)/my-reports")}
                    style={[
                      styles.reportCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={[styles.reportCardHeader, { flexDirection: row }]}>
                      <View
                        style={[
                          styles.catIcon,
                          { backgroundColor: colors.secondary },
                        ]}
                      >
                        <Feather
                          name={categoryIcon(report.threat_class)}
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: statusColor(report.status) },
                        ]}
                      />
                    </View>
                    <Text
                      style={[styles.reportRef, { color: colors.text, textAlign }]}
                      numberOfLines={1}
                    >
                      {report.reference}
                    </Text>
                    <Text style={[styles.reportDate, { color: colors.mutedForeground, textAlign }]}>
                      {formatDate(report.created_at, isRTL)}
                    </Text>
                    <SeverityBadge level={report.risk_level || report.severity_label} size="sm" />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* ── Language selector ─────────────────────────────── */}
        <GlassCard padding={16}>
          <Text
            style={[styles.langLabel, { color: colors.mutedForeground, textAlign }]}
          >
            {t("home_language")}
          </Text>
          <View style={[styles.langRow, { flexDirection: row }]}>
            {LANGUAGE_OPTIONS.map(opt => (
              <Pressable
                key={opt.code}
                onPress={() => setLanguage(opt.code as Language)}
                style={[
                  styles.langChip,
                  {
                    backgroundColor:
                      language === opt.code ? colors.primary : colors.surface2,
                    borderColor:
                      language === opt.code ? colors.primary : colors.border,
                    flex: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.langChipText,
                    {
                      color:
                        language === opt.code
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {opt.nativeLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { alignItems: "center", gap: 12 },
  greeting: { fontSize: 14, fontWeight: "500" as const },
  appName: { fontSize: 26, fontWeight: "900" as const, letterSpacing: 4, lineHeight: 32 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineChip: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  offlineChipText: { fontSize: 13, fontWeight: "600" as const, flex: 1 },
  ctaBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: "#2D7A3A",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaInner: { alignItems: "center", justifyContent: "center", gap: 12 },
  ctaText: { fontSize: 17, fontWeight: "800" as const, letterSpacing: 1 },
  heatRow: { alignItems: "flex-start", gap: 0 },
  heatIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heatTitle: { fontSize: 13, fontWeight: "700" as const, letterSpacing: 0.3, marginBottom: 3 },
  heatBody: { fontSize: 12, lineHeight: 17 },
  sectionHeader: { justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700" as const },
  viewAll: { fontSize: 13, fontWeight: "600" as const },
  loadingRow: { alignItems: "center", paddingVertical: 20 },
  emptyText: { fontSize: 14, lineHeight: 20 },
  stripScroll: { marginHorizontal: -4 },
  stripRow: { gap: 10, paddingHorizontal: 4, paddingBottom: 4 },
  reportCard: {
    width: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reportCardHeader: { justifyContent: "space-between", alignItems: "center" },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  reportRef: { fontSize: 13, fontWeight: "700" as const, letterSpacing: 0.3 },
  reportDate: { fontSize: 11 },
  langLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 10 },
  langRow: { gap: 8 },
  langChip: {
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  langChipText: { fontSize: 13, fontWeight: "700" as const },
});
