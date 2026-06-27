import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SeverityBadge } from "@/components/SeverityBadge";
import { apiFetch, apiGet } from "@/constants/api";
import { apiOrigin } from "@/constants/env";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

// ─── types ───────────────────────────────────────────────────────────────────

interface Report {
  id: number;
  reference: string;
  threat_class: string | null;
  threat_label: string | null;
  description: string;
  status: string;
  severity: number;
  severity_label: string;
  risk_level: string;
  latitude: number | null;
  longitude: number | null;
  address_details: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  image_url: string | null;
  due_at: string | null;
  created_at: string | null;
  escalation_required: boolean;
  reporter_username: string | null;
}

type SevFilter = "all" | "low" | "medium" | "high" | "critical";
type StatusFilter =
  | "all"
  | "pending_review"
  | "under_review"
  | "assigned"
  | "completed"
  | "rejected"
  | "late";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return `${apiOrigin()}${imageUrl}`;
}

const CATEGORY_ICONS: Record<string, string> = {
  heat_stress: "thermometer",
  road_damage: "navigation",
  waste: "trash-2",
  flood: "droplet",
  fire: "alert-triangle",
  electrical: "zap",
  structural: "home",
  other: "more-horizontal",
};

function catIcon(cls: string | null): string {
  if (!cls) return "alert-triangle";
  return CATEGORY_ICONS[cls] ?? "alert-triangle";
}

function formatDateTime(iso: string | null, isRTL: boolean): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(isRTL ? "ar-AE" : "en-AE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending_review: { color: "#6B7280", bg: "#F3F4F6" },
  under_review: { color: "#2563EB", bg: "#EFF6FF" },
  assigned: { color: "#D97706", bg: "#FFFBEB" },
  completed: { color: "#16A34A", bg: "#F0FDF4" },
  rejected: { color: "#DC2626", bg: "#FEF2F2" },
  late: { color: "#EA580C", bg: "#FFF7ED" },
};

function passesSevFilter(r: Report, f: SevFilter): boolean {
  if (f === "all") return true;
  const s = r.severity ?? 0;
  if (f === "low") return s <= 2;
  if (f === "medium") return s >= 3 && s <= 4;
  if (f === "high") return s >= 5 && s <= 6;
  if (f === "critical") return s >= 7;
  return true;
}

// ─── StatusPill ──────────────────────────────────────────────────────────────

function StatusPill({ status, label }: { status: string; label: string }) {
  const s = STATUS_STYLE[status] ?? { color: "#6B7280", bg: "#F3F4F6" };
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg, borderColor: s.color + "44" }]}>
      <Text style={[styles.statusPillText, { color: s.color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ─── ReportCard (view + delete) ──────────────────────────────────────────────

function ReportCard({
  report,
  expanded,
  onToggle,
  onDelete,
  colors,
  isRTL,
  statusLabels,
}: {
  report: Report;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: number) => Promise<void>;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  statusLabels: Record<string, string>;
}) {
  const { t } = useTranslation();
  const rowDir: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
  const textAlign: "left" | "right" = isRTL ? "right" : "left";

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const imgUrl = getImageUrl(report.image_url);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: report.escalation_required ? "#DC262644" : colors.border },
      ]}
    >
      <Pressable onPress={onToggle}>
        {/* Header */}
        <View style={[styles.cardHeader, { flexDirection: rowDir }]}>
          <View style={styles.catIconWrap}>
            <Feather name={catIcon(report.threat_class) as never} size={18} color={colors.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardRef, { color: colors.text, textAlign }]}>{report.reference}</Text>
            <Text style={[styles.cardCat, { color: colors.mutedForeground, textAlign }]}>
              {report.threat_label ?? report.threat_class ?? ""}
            </Text>
          </View>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </View>

        {/* Badges */}
        <View style={[styles.badgeRow, { flexDirection: rowDir, marginTop: 8 }]}>
          <StatusPill status={report.status} label={statusLabels[report.status] ?? report.status} />
          <SeverityBadge level={report.severity_label || report.risk_level || "low"} size="sm" />
          {report.escalation_required && (
            <View style={styles.escalatedBadge}>
              <Text style={styles.escalatedText}>⚠ {t("sup_escalated").toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Location + reporter */}
        <Text style={[styles.cardMeta, { color: colors.mutedForeground, textAlign, marginTop: 6 }]} numberOfLines={1}>
          {report.address_details ||
            (report.latitude != null && report.longitude != null
              ? `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`
              : "")}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground, textAlign }]}>
          {formatDateTime(report.created_at, isRTL)}
          {report.reporter_username ? `  ·  ${t("sup_reporter")}: ${report.reporter_username}` : ""}
        </Text>

        {!!imgUrl && <Image source={{ uri: imgUrl }} style={styles.thumbnail} resizeMode="cover" />}

        {expanded && !!report.description && (
          <View style={[styles.detailSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground, textAlign }]}>
              {t("sup_description")}
            </Text>
            <Text style={[styles.detailValue, { color: colors.text, textAlign }]}>{report.description}</Text>
            {!!report.phone_primary && (
              <Text style={[styles.detailValue, { color: colors.mutedForeground, textAlign, marginTop: 8 }]}>
                {t("sup_phone")}: {report.phone_primary}
                {report.phone_secondary ? ` / ${report.phone_secondary}` : ""}
              </Text>
            )}
          </View>
        )}
      </Pressable>

      {/* Delete row */}
      <View style={[styles.deleteRow, { borderTopColor: colors.border, flexDirection: rowDir }]}>
        {confirming ? (
          <>
            <Text style={[styles.confirmText, { color: colors.text, textAlign }]}>
              {t("reports_delete_confirm")}
            </Text>
            <Pressable
              style={[styles.smallBtn, { borderColor: colors.border }]}
              onPress={() => setConfirming(false)}
              disabled={deleting}
            >
              <Text style={[styles.smallBtnText, { color: colors.mutedForeground }]}>{t("reports_cancel")}</Text>
            </Pressable>
            <Pressable
              style={[styles.smallBtn, { backgroundColor: "#DC2626", borderColor: "#DC2626" }]}
              onPress={async () => {
                setDeleting(true);
                try {
                  await onDelete(report.id);
                } finally {
                  setDeleting(false);
                  setConfirming(false);
                }
              }}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.smallBtnText, { color: "#fff" }]}>{t("reports_delete")}</Text>
              )}
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.deleteTrigger, { flexDirection: rowDir }]}
            onPress={() => setConfirming(true)}
            hitSlop={6}
          >
            <Feather name="trash-2" size={15} color="#DC2626" />
            <Text style={[styles.deleteTriggerText, { color: "#DC2626" }]}>{t("reports_delete")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const colors = useColors();
  const { t, isRTL } = useTranslation();
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();

  const isSupervisor = user?.role === "supervisor" || user?.role === "admin";

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sevFilter, setSevFilter] = useState<SevFilter>("all");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const rowDir: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";

  const statusLabels: Record<string, string> = {
    pending_review: t("status_pending_review"),
    under_review: t("status_under_review"),
    assigned: t("status_assigned"),
    completed: t("status_completed"),
    rejected: t("status_rejected"),
    late: t("status_late"),
  };

  const fetchData = useCallback(
    async (silent = false) => {
      if (!isSupervisor) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        const data = await apiGet<{ reports: Report[]; total: number }>(
          `/supervisor/reports${params.toString() ? `?${params.toString()}` : ""}`,
          token,
        );
        setReports(data.reports);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isSupervisor, token, statusFilter],
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const res = await apiFetch(`/supervisor/reports/${id}`, { method: "DELETE" }, token);
      if (!res.ok) {
        setError((await res.text()) || `HTTP ${res.status}`);
        return;
      }
      setReports((prev) => prev.filter((r) => r.id !== id));
    },
    [token],
  );

  const handleClearDemo = useCallback(async () => {
    setClearing(true);
    try {
      const res = await apiFetch(`/supervisor/reports/clear-demo`, { method: "POST" }, token);
      if (!res.ok) {
        setError((await res.text()) || `HTTP ${res.status}`);
        return;
      }
      await fetchData(true);
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }, [token, fetchData]);

  // ── guard ──
  if (!isSupervisor) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.guardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={[styles.heading, { color: colors.text, textAlign: "center" }]}>
            {t("sup_access_restricted")}
          </Text>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace("/(tabs)")}>
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>{t("sup_go_home")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const filtered = reports.filter((r) => passesSevFilter(r, sevFilter));

  const statusOpts: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("sup_all") },
    { key: "pending_review", label: statusLabels["pending_review"]! },
    { key: "under_review", label: statusLabels["under_review"]! },
    { key: "assigned", label: statusLabels["assigned"]! },
    { key: "completed", label: statusLabels["completed"]! },
    { key: "rejected", label: statusLabels["rejected"]! },
    { key: "late", label: statusLabels["late"]! },
  ];
  const sevOpts: { key: SevFilter; label: string }[] = [
    { key: "all", label: t("sup_all") },
    { key: "critical", label: t("sev_critical") },
    { key: "high", label: t("sev_high") },
    { key: "medium", label: t("sev_medium") },
    { key: "low", label: t("sev_low") },
  ];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />
      }
    >
      {/* Header + clear-demo */}
      <View style={[styles.titleRow, { flexDirection: rowDir }]}>
        <Text style={[styles.heading, { color: colors.text }]}>
          {t("reports_title")} {!loading && `(${filtered.length})`}
        </Text>
        {!confirmClear && (
          <Pressable
            style={[styles.clearBtn, { borderColor: "#DC2626", flexDirection: rowDir }]}
            onPress={() => setConfirmClear(true)}
          >
            <Feather name="trash" size={13} color="#DC2626" />
            <Text style={[styles.clearBtnText, { color: "#DC2626" }]}>{t("reports_clear_demo")}</Text>
          </Pressable>
        )}
      </View>

      {/* Clear-demo confirm */}
      {confirmClear && (
        <View style={[styles.confirmBar, { backgroundColor: "#FEF2F2", borderColor: "#DC262644", flexDirection: rowDir }]}>
          <Text style={[styles.confirmBarText, { color: "#DC2626" }]}>{t("reports_clear_demo_confirm")}</Text>
          <Pressable style={[styles.smallBtn, { borderColor: colors.border }]} onPress={() => setConfirmClear(false)} disabled={clearing}>
            <Text style={[styles.smallBtnText, { color: colors.mutedForeground }]}>{t("reports_cancel")}</Text>
          </Pressable>
          <Pressable
            style={[styles.smallBtn, { backgroundColor: "#DC2626", borderColor: "#DC2626" }]}
            onPress={handleClearDemo}
            disabled={clearing}
          >
            {clearing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.smallBtnText, { color: "#fff" }]}>{t("reports_delete")}</Text>}
          </Pressable>
        </View>
      )}

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <View style={[styles.chipRow, { flexDirection: rowDir }]}>
          {statusOpts.map((o) => {
            const active = statusFilter === o.key;
            return (
              <Pressable
                key={o.key}
                style={[styles.filterChip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                onPress={() => setStatusFilter(o.key)}
              >
                <Text style={[styles.filterChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={[styles.chipRow, { flexDirection: rowDir }]}>
          {sevOpts.map((o) => {
            const active = sevFilter === o.key;
            return (
              <Pressable
                key={o.key}
                style={[styles.filterChip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                onPress={() => setSevFilter(o.key)}
              >
                <Text style={[styles.filterChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.cardMeta, { color: colors.mutedForeground, marginTop: 8 }]}>{t("my_reports_loading")}</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={28} color="#DC2626" />
          <Text style={[styles.cardMeta, { color: "#DC2626", marginTop: 6, textAlign: "center" }]}>{error}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="inbox" size={32} color={colors.mutedForeground} />
          <Text style={[styles.cardMeta, { color: colors.mutedForeground, marginTop: 8 }]}>{t("sup_no_reports")}</Text>
        </View>
      ) : (
        filtered.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            expanded={expandedId === report.id}
            onToggle={() => setExpandedId((prev) => (prev === report.id ? null : report.id))}
            onDelete={handleDelete}
            colors={colors}
            isRTL={isRTL}
            statusLabels={statusLabels}
          />
        ))
      )}
    </ScrollView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  centered: { alignItems: "center", paddingVertical: 40 },
  guardCard: {
    width: "100%", maxWidth: 360, borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 16,
  },
  heading: { fontSize: 20, fontWeight: "700" as const },
  primaryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  primaryBtnText: { fontWeight: "600" as const, fontSize: 14 },

  titleRow: { alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 },
  clearBtn: { alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  clearBtnText: { fontSize: 12, fontWeight: "600" as const },

  confirmBar: { alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 12, flexWrap: "wrap" },
  confirmBarText: { fontSize: 12, fontWeight: "600" as const, flex: 1, minWidth: 140 },

  chipRow: { gap: 8, flexWrap: "nowrap" },
  filterChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  filterChipText: { fontSize: 12, fontWeight: "600" as const },

  card: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader: { alignItems: "flex-start", gap: 10 },
  catIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardHeaderText: { flex: 1 },
  cardRef: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 0.3 },
  cardCat: { fontSize: 11, fontWeight: "600" as const, marginTop: 1 },
  badgeRow: { gap: 6, flexWrap: "wrap", alignItems: "center" },
  cardMeta: { fontSize: 12 },
  thumbnail: { width: "100%", height: 120, borderRadius: 10, marginTop: 10 },

  detailSection: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  detailLabel: { fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.4, marginBottom: 4 },
  detailValue: { fontSize: 13, lineHeight: 20 },

  statusPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.4 },
  escalatedBadge: { borderRadius: 999, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#DC262644", paddingHorizontal: 8, paddingVertical: 3 },
  escalatedText: { fontSize: 10, fontWeight: "700" as const, color: "#DC2626", letterSpacing: 0.4 },

  deleteRow: { borderTopWidth: 1, marginTop: 12, paddingTop: 10, alignItems: "center", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" },
  deleteTrigger: { alignItems: "center", gap: 6, paddingVertical: 2 },
  deleteTriggerText: { fontSize: 13, fontWeight: "600" as const },
  confirmText: { fontSize: 12, fontWeight: "600" as const, flex: 1, minWidth: 120 },
  smallBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, minWidth: 64, alignItems: "center", justifyContent: "center" },
  smallBtnText: { fontSize: 12, fontWeight: "700" as const },
});
