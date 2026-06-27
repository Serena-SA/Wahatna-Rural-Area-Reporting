import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SeverityBadge } from "@/components/SeverityBadge";
import { apiGet } from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

// ─── types ───────────────────────────────────────────────────────────────────

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  note?: string;
}

function getImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "http://localhost:8080";
  return `${base}${imageUrl}`;
}

interface Report {
  id: number;
  reference: string;
  threat_class: string | null;
  threat_label: string | null;
  description: string;
  status: string;
  severity_label: string;
  risk_level: string;
  latitude: number | null;
  longitude: number | null;
  location_source: string | null;
  address_details: string | null;
  phone_primary: string | null;
  image_filename: string | null;
  image_url: string | null;
  assessment_summary: string | null;
  supervisor_notes: string | null;
  status_history: StatusHistoryEntry[];
  due_at: string | null;
  created_at: string | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_ICONS = {
  heat_stress: "thermometer",
  road_damage: "navigation",
  waste: "trash-2",
  flood: "droplet",
  fire: "alert-triangle",
  electrical: "zap",
  structural: "home",
  other: "more-horizontal",
} as const;

type CatIconName = (typeof CATEGORY_ICONS)[keyof typeof CATEGORY_ICONS];

function catIcon(cls: string | null): CatIconName {
  if (!cls) return "alert-triangle";
  return ((CATEGORY_ICONS as Record<string, CatIconName>)[cls]) ?? "alert-triangle";
}

interface StatusStyle {
  color: string;
  bg: string;
  label: string;
}

function useStatusConfig(t: (k: string) => string): Record<string, StatusStyle> {
  return {
    pending_review: { color: "#6B7280", bg: "#F3F4F6", label: t("status_pending_review") },
    under_review:   { color: "#2563EB", bg: "#EFF6FF", label: t("status_under_review")   },
    assigned:       { color: "#D97706", bg: "#FFFBEB", label: t("status_assigned")        },
    completed:      { color: "#16A34A", bg: "#F0FDF4", label: t("status_completed")       },
    rejected:       { color: "#DC2626", bg: "#FEF2F2", label: t("status_rejected")        },
    late:           { color: "#EA580C", bg: "#FFF7ED", label: t("status_late")            },
  };
}

function StatusPill({ status, config }: { status: string; config: Record<string, StatusStyle> }) {
  const s = config[status] ?? { color: "#6B7280", bg: "#F3F4F6", label: status };
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg, borderColor: s.color + "44" }]}>
      <Text style={[styles.statusPillText, { color: s.color }]}>{s.label.toUpperCase()}</Text>
    </View>
  );
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

// ─── status change banner ─────────────────────────────────────────────────────

function StatusChangeBanner({ report, onDismiss, colors, isRTL }: {
  report: Report | null;
  onDismiss: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  isRTL: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();

  useEffect(() => {
    if (report) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 18 }).start();
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [report, anim, onDismiss]);

  if (!report) return null;
  const row: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
  return (
    <Animated.View
      style={[
        styles.changeBanner,
        { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }] },
      ]}
    >
      <View style={[styles.changeBannerInner, { flexDirection: row }]}>
        <Feather name="info" size={14} color="#2563EB" />
        <Text style={[styles.changeBannerText, { color: "#2563EB" }]}>
          {report.reference} — {t("my_reports_status_changed")}
        </Text>
        <Pressable onPress={onDismiss} style={styles.bannerClose}>
          <Feather name="x" size={14} color="#2563EB" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── expanded card ────────────────────────────────────────────────────────────

function ReportDetail({
  report,
  statusConfig,
  isRTL,
  colors,
}: {
  report: Report;
  statusConfig: Record<string, StatusStyle>;
  isRTL: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const { t } = useTranslation();
  const textAlign: "left" | "right" = isRTL ? "right" : "left";
  const row: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";

  return (
    <View style={[styles.detailContainer, { borderTopColor: colors.border }]}>
      {/* Full description */}
      {!!report.description && (
        <Text style={[styles.detailDesc, { color: colors.text, textAlign }]}>
          {report.description}
        </Text>
      )}

      {/* Contact */}
      {!!report.phone_primary && (
        <View style={[styles.detailRow, { flexDirection: row }]}>
          <Feather name="phone" size={14} color={colors.mutedForeground} style={isRTL ? styles.iconRTL : styles.iconLTR} />
          <Text style={[styles.detailRowText, { color: colors.text }]}>{report.phone_primary}</Text>
        </View>
      )}

      {/* Location */}
      {(report.location_source || report.address_details) && (
        <View style={[styles.detailRow, { flexDirection: row }]}>
          <Feather name="map-pin" size={14} color={colors.mutedForeground} style={isRTL ? styles.iconRTL : styles.iconLTR} />
          <Text style={[styles.detailRowText, { color: colors.text }]}>
            {report.address_details ?? `${report.latitude?.toFixed(4)}, ${report.longitude?.toFixed(4)}`}
          </Text>
        </View>
      )}

      {/* Supervisor notes */}
      {!!report.supervisor_notes && (
        <View style={[styles.notesBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <View style={[styles.notesHeader, { flexDirection: row }]}>
            <Feather name="message-square" size={13} color={colors.primary} style={isRTL ? styles.iconRTL : styles.iconLTR} />
            <Text style={[styles.notesTitle, { color: colors.primary }]}>{t("my_reports_supervisor_notes")}</Text>
          </View>
          <Text style={[styles.notesText, { color: colors.text, textAlign }]}>{report.supervisor_notes}</Text>
        </View>
      )}

      {/* Status history */}
      {report.status_history && report.status_history.length > 0 && (
        <View style={styles.timeline}>
          <Text style={[styles.timelineTitle, { color: colors.mutedForeground, textAlign }]}>
            {t("my_reports_timeline")}
          </Text>
          {[...report.status_history].reverse().map((entry, i) => {
            const s = statusConfig[entry.status] ?? { color: "#6B7280", label: entry.status };
            return (
              <View key={i} style={[styles.timelineItem, { flexDirection: row }]}>
                <View style={[styles.timelineDot, { backgroundColor: s.color }]} />
                <View style={[styles.timelineLine, { backgroundColor: i < report.status_history.length - 1 ? colors.border : "transparent" }]} />
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <Text style={[styles.timelineStatus, { color: s.color, textAlign }]}>
                    {s.label ?? entry.status}
                  </Text>
                  <Text style={[styles.timelineDate, { color: colors.mutedForeground, textAlign }]}>
                    {formatDateTime(entry.timestamp, isRTL)}
                  </Text>
                  {!!entry.note && (
                    <Text style={[styles.timelineNote, { color: colors.text, textAlign }]}>
                      {entry.note}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── report card ─────────────────────────────────────────────────────────────

function ReportCard({
  report,
  expanded,
  onToggle,
  statusConfig,
  isRTL,
  colors,
}: {
  report: Report;
  expanded: boolean;
  onToggle: () => void;
  statusConfig: Record<string, StatusStyle>;
  isRTL: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const { t } = useTranslation();
  const textAlign: "left" | "right" = isRTL ? "right" : "left";
  const row: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
  const icon = catIcon(report.threat_class);

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: expanded ? colors.primary : colors.border },
      ]}
    >
      {/* Card header */}
      <View style={[styles.cardHeader, { flexDirection: row }]}>
        <View style={[styles.catIconWrap, { backgroundColor: colors.secondary }]}>
          <Feather name={icon} size={18} color={colors.primary} />
        </View>

        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text style={[styles.cardRef, { color: colors.text, textAlign }]}>
            {report.reference}
          </Text>
          <Text style={[styles.cardCat, { color: colors.primary, textAlign }]}>
            {report.threat_label || (report.threat_class ? t(`cat_${report.threat_class}` as never) : "")}
          </Text>
          <Text style={[styles.cardDate, { color: colors.mutedForeground, textAlign }]}>
            {formatDateTime(report.created_at, isRTL)}
          </Text>
        </View>

        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.mutedForeground}
        />
      </View>

      {/* Badges row */}
      <View style={[styles.badgeRow, { flexDirection: row }]}>
        <SeverityBadge level={report.risk_level || report.severity_label} size="sm" />
        <StatusPill status={report.status} config={statusConfig} />
        {report.location_source && (
          <View style={[styles.locChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Feather name="map-pin" size={10} color={colors.mutedForeground} />
            <Text style={[styles.locChipText, { color: colors.mutedForeground }]}>
              {report.location_source.toUpperCase()}
            </Text>
          </View>
        )}
        {report.image_filename && (
          <View style={[styles.locChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Feather name="camera" size={10} color={colors.mutedForeground} />
            <Text style={[styles.locChipText, { color: colors.mutedForeground }]}>
              {t("my_reports_photos_attached")}
            </Text>
          </View>
        )}
      </View>

      {/* Photo thumbnail strip */}
      {report.image_url && (() => {
        const thumbUrl = getImageUrl(report.image_url);
        return thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={styles.reportThumb}
            resizeMode="cover"
          />
        ) : null;
      })()}

      {/* Expanded detail */}
      {expanded && (
        <ReportDetail
          report={report}
          statusConfig={statusConfig}
          isRTL={isRTL}
          colors={colors}
        />
      )}
    </Pressable>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function MyReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, isRTL } = useTranslation();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [changedReport, setChangedReport] = useState<Report | null>(null);

  const prevReportsRef = useRef<Report[]>([]);
  const statusConfig = useStatusConfig((k: string) => t(k as never));

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 80);
  const textAlign: "left" | "right" = isRTL ? "right" : "left";

  const fetchReports = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet<{ reports: Report[] }>("/reports/my", token);
      const next = data.reports;

      // detect status changes between polls
      if (prevReportsRef.current.length > 0) {
        const changed = next.find(r => {
          const old = prevReportsRef.current.find(p => p.id === r.id);
          return old && old.status !== r.status;
        });
        if (changed) setChangedReport(changed);
      }

      prevReportsRef.current = next;
      setReports(next);
    } catch {
      // silently ignore network errors during polling
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 20000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusChangeBanner
        report={changedReport}
        onDismiss={() => setChangedReport(null)}
        colors={colors}
        isRTL={isRTL}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: bottomPad,
          paddingHorizontal: 16,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <Text style={[styles.pageTitle, { color: colors.text, textAlign }]}>
          {t("my_reports_title")}
        </Text>

        {loading && (
          <View style={styles.loadingState}>
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              {t("my_reports_loading")}
            </Text>
          </View>
        )}

        {!loading && reports.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="file-text" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text, textAlign: "center" }]}>
              {t("my_reports_empty")}
            </Text>
            <Pressable
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(tabs)/report")}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>
                {t("home_report_cta")}
              </Text>
            </Pressable>
          </View>
        )}

        {reports.map(report => (
          <ReportCard
            key={report.id}
            report={report}
            expanded={expandedId === report.id}
            onToggle={() => setExpandedId(prev => prev === report.id ? null : report.id)}
            statusConfig={statusConfig}
            isRTL={isRTL}
            colors={colors}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageTitle: { fontSize: 24, fontWeight: "800" as const, letterSpacing: -0.3 },
  loadingState: { alignItems: "center", paddingVertical: 40 },
  loadingText: { fontSize: 14 },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyTitle: { fontSize: 15, lineHeight: 22, maxWidth: 260 },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  emptyBtnText: { fontWeight: "700" as const, fontSize: 14 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeader: { alignItems: "center" },
  catIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardRef: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 0.3 },
  cardCat: { fontSize: 11, fontWeight: "600" as const, marginTop: 1 },
  cardDate: { fontSize: 11, marginTop: 1 },
  badgeRow: { gap: 6, flexWrap: "wrap", alignItems: "center" },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  statusPillText: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.4 },
  locChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  locChipText: { fontSize: 10, fontWeight: "600" as const },
  reportThumb: { width: "100%", height: 120, borderRadius: 10, marginTop: 8 },
  detailContainer: { borderTopWidth: 1, paddingTop: 12, gap: 10, marginTop: 4 },
  detailDesc: { fontSize: 14, lineHeight: 21 },
  detailRow: { alignItems: "center", gap: 0 },
  detailRowText: { fontSize: 13, flex: 1 },
  iconLTR: { marginRight: 8 },
  iconRTL: { marginLeft: 8 },
  notesBox: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  notesHeader: { alignItems: "center", gap: 0 },
  notesTitle: { fontSize: 12, fontWeight: "700" as const },
  notesText: { fontSize: 13, lineHeight: 20 },
  timeline: { gap: 0 },
  timelineTitle: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 10 },
  timelineItem: { gap: 0, alignItems: "flex-start" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  timelineLine: { width: 2, flex: 1, marginLeft: 4, marginTop: 2, alignSelf: "stretch", minHeight: 14, position: "absolute", top: 14, left: 4 },
  changeBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    borderBottomWidth: 1,
  },
  changeBannerInner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    gap: 8,
  },
  changeBannerText: { fontSize: 13, fontWeight: "600" as const, flex: 1 },
  bannerClose: { padding: 4 },
  timelineStatus: { fontSize: 13, fontWeight: "700" as const },
  timelineDate: { fontSize: 11, marginTop: 2 },
  timelineNote: { fontSize: 12, marginTop: 4, lineHeight: 18 },
});
