import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RouteMap } from "@/components/RouteMap";
import { SeverityBadge } from "@/components/SeverityBadge";
import { apiFetch, apiGet } from "@/constants/api";
import type { MapPoint } from "@/constants/mapHtml";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

// ─── types ───────────────────────────────────────────────────────────────────

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  note?: string;
}

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
  location_source: string | null;
  address_details: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  image_url: string | null;
  supervisor_notes: string | null;
  rejection_reason: string | null;
  resources_dispatched_at: string | null;
  status_history: StatusHistoryEntry[];
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  escalation_required: boolean;
  reporter_username: string | null;
}

interface DashboardData {
  counts: Record<string, number>;
  critical_count: number;
  late_count: number;
  total: number;
  active_incidents: Report[];
}

type DateFilter = "all" | "today" | "this_week";
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
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}` : "http://localhost:8080";
  return `${base}${imageUrl}`;
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

function slaInfo(
  dueAt: string | null,
  dueInLabel: string,
  overdueLabel: string,
  timeH: string,
  timeM: string,
  createdAt?: string | null,
): { label: string; color: string; urgency: "ok" | "amber" | "red" } {
  if (!dueAt) return { label: "", color: "#6B7280", urgency: "ok" };
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diff = due - now;
  if (diff <= 0) {
    const over = Math.abs(diff);
    const h = Math.floor(over / 3600000);
    const m = Math.floor((over % 3600000) / 60000);
    return { label: `${overdueLabel} — ${h}${timeH} ${m}${timeM}`, color: "#DC2626", urgency: "red" };
  }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  // Amber when <25% of the SLA window remains; fall back to <18 h if no createdAt
  const windowMs = createdAt ? due - new Date(createdAt).getTime() : 72 * 3600000;
  const urgency = windowMs > 0 && diff / windowMs < 0.25 ? "amber" : "ok";
  return {
    label: `${dueInLabel} ${h}${timeH} ${m}${timeM}`,
    color: urgency === "amber" ? "#D97706" : "#16A34A",
    urgency,
  };
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pending_review: { color: "#6B7280", bg: "#F3F4F6" },
  under_review:   { color: "#2563EB", bg: "#EFF6FF" },
  assigned:       { color: "#D97706", bg: "#FFFBEB" },
  completed:      { color: "#16A34A", bg: "#F0FDF4" },
  rejected:       { color: "#DC2626", bg: "#FEF2F2" },
  late:           { color: "#EA580C", bg: "#FFF7ED" },
};

function passesDateFilter(r: Report, f: DateFilter): boolean {
  if (f === "all" || !r.created_at) return true;
  const d = new Date(r.created_at);
  const now = new Date();
  if (f === "today") {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}

function passesSevFilter(r: Report, f: SevFilter): boolean {
  if (f === "all") return true;
  const s = r.severity ?? 0;
  if (f === "low") return s <= 2;
  if (f === "medium") return s >= 3 && s <= 4;
  if (f === "high") return s >= 5 && s <= 6;
  if (f === "critical") return s >= 7;
  return true;
}

const NEXT_STATUSES = ["pending_review", "under_review", "assigned", "completed", "rejected"];

// ─── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ status, label }: { status: string; label: string }) {
  const s = STATUS_STYLE[status] ?? { color: "#6B7280", bg: "#F3F4F6" };
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg, borderColor: s.color + "44" }]}>
      <Text style={[styles.statusPillText, { color: s.color }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

// ─── SlaChip ─────────────────────────────────────────────────────────────────

function SlaChip({ info }: { info: ReturnType<typeof slaInfo> }) {
  if (!info.label) return null;
  return (
    <View
      style={[
        styles.slaChip,
        { backgroundColor: info.color + "18", borderColor: info.color + "44" },
      ]}
    >
      <Text style={[styles.slaChipText, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

// ─── FilterBar ───────────────────────────────────────────────────────────────

function FilterBar({
  statusFilter,
  sevFilter,
  lateOnly,
  dateFilter,
  onStatusChange,
  onSevChange,
  onLateOnlyChange,
  onDateChange,
  colors,
  isRTL,
  statusLabels,
}: {
  statusFilter: StatusFilter;
  sevFilter: SevFilter;
  lateOnly: boolean;
  dateFilter: DateFilter;
  onStatusChange: (v: StatusFilter) => void;
  onSevChange: (v: SevFilter) => void;
  onLateOnlyChange: (v: boolean) => void;
  onDateChange: (v: DateFilter) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  isRTL: boolean;
  statusLabels: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rowDir: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";

  const statusOpts: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("sup_all") },
    { key: "pending_review", label: statusLabels["pending_review"] ?? "Pending" },
    { key: "under_review", label: statusLabels["under_review"] ?? "Under Review" },
    { key: "assigned", label: statusLabels["assigned"] ?? "Assigned" },
    { key: "completed", label: statusLabels["completed"] ?? "Completed" },
    { key: "rejected", label: statusLabels["rejected"] ?? "Rejected" },
    { key: "late", label: statusLabels["late"] ?? "Late" },
  ];

  const sevOpts: { key: SevFilter; label: string }[] = [
    { key: "all", label: t("sup_all") },
    { key: "critical", label: t("sev_critical") },
    { key: "high", label: t("sev_high") },
    { key: "medium", label: t("sev_medium") },
    { key: "low", label: t("sev_low") },
  ];

  const dateOpts: { key: DateFilter; label: string }[] = [
    { key: "all", label: t("sup_all") },
    { key: "today", label: t("sup_today") },
    { key: "this_week", label: t("sup_this_week") },
  ];

  function ChipRow<T extends string>({
    options,
    value,
    onChange,
  }: {
    options: { key: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
  }) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        <View style={[styles.chipRow, { flexDirection: rowDir }]}>
          {options.map((o) => {
            const active = value === o.key;
            return (
              <Pressable
                key={o.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => onChange(o.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.filterBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        style={[styles.filterHeader, { flexDirection: rowDir }]}
        onPress={() => setOpen((o) => !o)}
      >
        <Feather name="sliders" size={16} color={colors.mutedForeground} />
        <Text style={[styles.filterHeaderText, { color: colors.text }]}>{t("sup_filters")}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </Pressable>

      {open && (
        <View style={styles.filterBody}>
          <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>{t("sup_filter_status")}</Text>
          <ChipRow options={statusOpts} value={statusFilter} onChange={onStatusChange} />

          <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>{t("sup_filter_severity")}</Text>
          <ChipRow options={sevOpts} value={sevFilter} onChange={onSevChange} />

          <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>{t("sup_filter_date")}</Text>
          <ChipRow options={dateOpts} value={dateFilter} onChange={onDateChange} />

          <Pressable
            style={[styles.lateOnlyRow, { flexDirection: rowDir }]}
            onPress={() => onLateOnlyChange(!lateOnly)}
          >
            <View
              style={[
                styles.toggle,
                { backgroundColor: lateOnly ? colors.primary : colors.surface, borderColor: lateOnly ? colors.primary : colors.border },
              ]}
            >
              {lateOnly && <Feather name="check" size={12} color={colors.primaryForeground} />}
            </View>
            <Text style={[styles.filterLabel, { color: colors.text, marginBottom: 0 }]}>{t("sup_late_only")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── ReportCard ───────────────────────────────────────────────────────────────

function ReportCard({
  report,
  expanded,
  onToggle,
  onUpdated,
  colors,
  isRTL,
  token,
  statusLabels,
}: {
  report: Report;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: (updated: Report) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  isRTL: boolean;
  token: string | null | undefined;
  statusLabels: Record<string, string>;
}) {
  const { t } = useTranslation();
  const rowDir: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
  const textAlign: "left" | "right" = isRTL ? "right" : "left";

  const [selStatus, setSelStatus] = useState(report.status);
  const [statusNote, setStatusNote] = useState("");
  const [rejReason, setRejReason] = useState(report.rejection_reason ?? "");
  const [notesText, setNotesText] = useState(report.supervisor_notes ?? "");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    setSelStatus(report.status);
    setRejReason(report.rejection_reason ?? "");
    setNotesText(report.supervisor_notes ?? "");
  }, [report.status, report.rejection_reason, report.supervisor_notes]);

  const sla = slaInfo(report.due_at, t("sup_due_in"), t("sup_overdue"), t("time_h"), t("time_m"), report.created_at);
  const imgUrl = getImageUrl(report.image_url);

  async function handleStatusUpdate() {
    if (selStatus === "rejected" && !rejReason.trim()) {
      Alert.alert("", t("sup_rejection_required"));
      return;
    }
    setUpdatingStatus(true);
    try {
      const body: Record<string, string> = { status: selStatus, note: statusNote };
      if (selStatus === "rejected") body["rejection_reason"] = rejReason.trim();
      const res = await apiFetch(
        `/supervisor/reports/${report.id}/status`,
        { method: "PATCH", body: JSON.stringify(body) },
        token,
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const updated = (await res.json()) as Report;
      onUpdated(updated);
      setStatusNote("");
    } catch (e: unknown) {
      Alert.alert(t("err_generic"), e instanceof Error ? e.message : String(e));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const res = await apiFetch(
        `/supervisor/reports/${report.id}/notes`,
        { method: "PATCH", body: JSON.stringify({ notes: notesText }) },
        token,
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const updated = (await res.json()) as Report;
      onUpdated(updated);
    } catch (e: unknown) {
      Alert.alert(t("err_generic"), e instanceof Error ? e.message : String(e));
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleDispatch() {
    setDispatching(true);
    try {
      const res = await apiFetch(
        `/supervisor/reports/${report.id}/dispatch`,
        { method: "PATCH" },
        token,
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const updated = (await res.json()) as Report;
      onUpdated(updated);
    } catch (e: unknown) {
      Alert.alert(t("err_generic"), e instanceof Error ? e.message : String(e));
    } finally {
      setDispatching(false);
    }
  }

  return (
    <Pressable
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: report.escalation_required ? "#DC262644" : colors.border },
      ]}
      onPress={onToggle}
    >
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

      {/* Badge row */}
      <View style={[styles.badgeRow, { flexDirection: rowDir, marginTop: 8 }]}>
        <StatusPill status={report.status} label={statusLabels[report.status] ?? report.status} />
        <SeverityBadge level={report.severity_label || report.risk_level || "low"} size="sm" />
        {report.escalation_required && (
          <View style={styles.escalatedBadge}>
            <Text style={styles.escalatedText}>⚠ {t("sup_escalated").toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* SLA */}
      {!!sla.label && (
        <View style={{ marginTop: 6 }}>
          <SlaChip info={sla} />
        </View>
      )}

      {/* Location + date */}
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

      {/* Thumbnail */}
      {!!imgUrl && (
        <Image source={{ uri: imgUrl }} style={styles.thumbnail} resizeMode="cover" />
      )}

      {/* ── Expanded detail ── */}
      {expanded && (
        <View style={[styles.detailSection, { borderTopColor: colors.border }]}>
          {!!report.description && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground, textAlign }]}>
                {t("sup_description")}
              </Text>
              <Text style={[styles.detailValue, { color: colors.text, textAlign }]}>
                {report.description}
              </Text>
            </View>
          )}

          {!!report.phone_primary && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground, textAlign }]}>
                {t("sup_phone")}
              </Text>
              <Text style={[styles.detailValue, { color: colors.text, textAlign }]}>
                {report.phone_primary}
                {report.phone_secondary ? `  /  ${report.phone_secondary}` : ""}
              </Text>
            </View>
          )}

          {/* Status update */}
          <Text style={[styles.detailLabel, { color: colors.mutedForeground, textAlign, marginBottom: 6 }]}>
            {t("sup_update_status")}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={[styles.chipRow, { flexDirection: rowDir }]}>
              {NEXT_STATUSES.map((s) => {
                const active = selStatus === s;
                return (
                  <Pressable
                    key={s}
                    style={[
                      styles.filterChip,
                      { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
                    ]}
                    onPress={() => setSelStatus(s)}
                  >
                    <Text style={[styles.filterChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                      {statusLabels[s] ?? s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {selStatus === "rejected" && (
            <TextInput
              style={[styles.textInput, { color: colors.text, backgroundColor: colors.surface, borderColor: "#DC2626", textAlign }]}
              placeholder={t("sup_rejection_reason")}
              placeholderTextColor={colors.mutedForeground}
              value={rejReason}
              onChangeText={setRejReason}
              multiline
              numberOfLines={2}
            />
          )}

          <TextInput
            style={[styles.textInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, textAlign, marginBottom: 8 }]}
            placeholder={t("sup_add_note")}
            placeholderTextColor={colors.mutedForeground}
            value={statusNote}
            onChangeText={setStatusNote}
            multiline
            numberOfLines={2}
          />

          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: updatingStatus ? 0.7 : 1 }]}
            onPress={handleStatusUpdate}
            disabled={updatingStatus}
          >
            {updatingStatus ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>
                {t("sup_update_status")}
              </Text>
            )}
          </Pressable>

          {/* Supervisor notes */}
          <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 12 }]} />
          <Text style={[styles.detailLabel, { color: colors.mutedForeground, textAlign, marginBottom: 6 }]}>
            {t("my_reports_supervisor_notes")}
          </Text>
          <TextInput
            style={[styles.textInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, textAlign, marginBottom: 8 }]}
            placeholder={t("sup_add_note")}
            placeholderTextColor={colors.mutedForeground}
            value={notesText}
            onChangeText={setNotesText}
            multiline
            numberOfLines={3}
          />
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, opacity: savingNotes ? 0.7 : 1 }]}
            onPress={handleSaveNotes}
            disabled={savingNotes}
          >
            {savingNotes ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>{t("sup_save_note")}</Text>
            )}
          </Pressable>

          {/* Resource dispatch (water / food) */}
          <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 12 }]} />
          {report.resources_dispatched_at ? (
            <View style={[styles.dispatchDone, { flexDirection: rowDir, borderColor: colors.success + "55", backgroundColor: colors.success + "14" }]}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.dispatchDoneText, { color: colors.success, textAlign }]}>
                {t("sup_dispatched")} · {formatDateTime(report.resources_dispatched_at, isRTL)}
              </Text>
            </View>
          ) : (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#0EA5E9", opacity: dispatching ? 0.7 : 1, flexDirection: rowDir, gap: 8 }]}
              onPress={handleDispatch}
              disabled={dispatching}
            >
              {dispatching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="package" size={16} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>{t("sup_dispatch")}</Text>
                </>
              )}
            </Pressable>
          )}

          {/* Status history timeline */}
          {report.status_history.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground, textAlign }]}>
                {t("my_reports_timeline")}
              </Text>
              {[...report.status_history].reverse().map((entry, i) => {
                const sc = STATUS_STYLE[entry.status] ?? { color: "#6B7280", bg: "#F3F4F6" };
                return (
                  <View key={i} style={[styles.timelineItem, { borderLeftColor: sc.color }]}>
                    <View style={[styles.timelinePill, { backgroundColor: sc.bg, borderColor: sc.color + "44" }]}>
                      <Text style={[styles.timelinePillText, { color: sc.color }]}>
                        {(statusLabels[entry.status] ?? entry.status).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.timelineMeta, { color: colors.mutedForeground, textAlign }]}>
                      {formatDateTime(entry.timestamp, isRTL)}
                    </Text>
                    {!!entry.note && (
                      <Text style={[styles.timelineNote, { color: colors.text, textAlign }]}>{entry.note}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SupervisorScreen() {
  const colors = useColors();
  const { t, isRTL } = useTranslation();
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();

  const isSupervisor = user?.role === "supervisor" || user?.role === "admin";

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sevFilter, setSevFilter] = useState<SevFilter>("all");
  const [lateOnly, setLateOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statsChip, setStatsChip] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        const apiStatus = statsChip ?? (statusFilter !== "all" ? statusFilter : undefined);
        if (apiStatus && apiStatus !== "all" && apiStatus !== "critical") params.set("status", apiStatus);
        if (lateOnly) params.set("late_only", "true");
        // Severity range → server-side filter
        if (sevFilter === "low")      { params.set("severity_min", "0");  params.set("severity_max", "2"); }
        if (sevFilter === "medium")   { params.set("severity_min", "3");  params.set("severity_max", "4"); }
        if (sevFilter === "high")     { params.set("severity_min", "5");  params.set("severity_max", "6"); }
        if (sevFilter === "critical") { params.set("severity_min", "7");  params.set("severity_max", "10"); }
        // Date range → server-side filter
        if (dateFilter === "today") {
          const from = new Date(); from.setHours(0, 0, 0, 0);
          params.set("date_from", from.toISOString());
        } else if (dateFilter === "this_week") {
          const from = new Date(); from.setDate(from.getDate() - from.getDay()); from.setHours(0, 0, 0, 0);
          params.set("date_from", from.toISOString());
        }

        const [dash, rpts] = await Promise.all([
          apiGet<DashboardData>("/supervisor/dashboard", token),
          apiGet<{ reports: Report[]; total: number }>(
            `/supervisor/reports${params.toString() ? `?${params.toString()}` : ""}`,
            token,
          ),
        ]);
        setDashboard(dash);
        setReports(rpts.reports);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isSupervisor, token, statusFilter, lateOnly, statsChip, sevFilter, dateFilter],
  );

  useFocusEffect(
    useCallback(() => {
      if (!isSupervisor) return;
      fetchData();
      pollingRef.current = setInterval(() => { fetchData(true); }, 30000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }, [fetchData, isSupervisor]),
  );

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, lateOnly, statsChip, sevFilter, dateFilter]);

  function handleUpdated(updated: Report) {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    fetchData(true);
  }

  // ── guard ──────────────────────────────────────────────────────
  if (!isSupervisor) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.guardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={[styles.heading, { color: colors.text }]}>{t("sup_access_restricted")}</Text>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.primary, paddingHorizontal: 24, marginTop: 8 }]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>{t("sup_go_home")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── derived ────────────────────────────────────────────────────
  const mapPoints: MapPoint[] = (dashboard?.active_incidents ?? [])
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      id: r.id,
      lat: r.latitude!,
      lon: r.longitude!,
      label: r.reference,
      kind: "stop" as const,
      color: r.escalation_required ? "#DC2626" : r.status === "late" ? "#EA580C" : "#2563EB",
    }));

  const filteredReports = reports.filter((r) => {
    if (!passesSevFilter(r, sevFilter)) return false;
    if (!passesDateFilter(r, dateFilter)) return false;
    // "Critical" stats chip filters client-side by severity >= 7
    if (statsChip === "critical" && (r.severity ?? 0) < 7) return false;
    return true;
  });

  const counts = dashboard?.counts ?? {};
  const statChips: { key: string; label: string; count: number }[] = [
    { key: "all",          label: t("sup_total"),       count: dashboard?.total ?? 0 },
    { key: "pending_review", label: t("sup_pending"),   count: counts["pending_review"] ?? 0 },
    { key: "under_review", label: t("sup_under_review"),count: counts["under_review"] ?? 0 },
    { key: "assigned",     label: t("sup_assigned"),    count: counts["assigned"] ?? 0 },
    { key: "completed",    label: t("sup_completed"),   count: counts["completed"] ?? 0 },
    { key: "late",         label: t("sup_late"),        count: dashboard?.late_count ?? 0 },
    { key: "critical",     label: t("sup_critical"),    count: dashboard?.critical_count ?? 0 },
  ];

  const rowDir: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }}
          tintColor={colors.primary}
        />
      }
    >
      {/* Title */}
      <Text style={[styles.heading, { color: colors.text, marginBottom: 12 }]}>{t("sup_title")}</Text>

      {/* Stats chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={[styles.chipRow, { flexDirection: rowDir }]}>
          {statChips.map((chip) => {
            const isActive = statsChip === chip.key || (chip.key === "all" && !statsChip);
            return (
              <Pressable
                key={chip.key}
                style={[
                  styles.statChip,
                  { backgroundColor: isActive ? colors.primary : colors.card, borderColor: isActive ? colors.primary : colors.border },
                ]}
                onPress={() => {
                  setStatsChip(chip.key === "all" ? null : chip.key);
                  setStatusFilter("all");
                }}
              >
                <Text style={[styles.statChipCount, { color: isActive ? colors.primaryForeground : colors.text }]}>
                  {chip.count}
                </Text>
                <Text style={[styles.statChipLabel, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Filter bar */}
      <FilterBar
        statusFilter={statusFilter}
        sevFilter={sevFilter}
        lateOnly={lateOnly}
        dateFilter={dateFilter}
        onStatusChange={(v) => { setStatusFilter(v); setStatsChip(null); }}
        onSevChange={setSevFilter}
        onLateOnlyChange={setLateOnly}
        onDateChange={setDateFilter}
        colors={colors}
        isRTL={isRTL}
        statusLabels={statusLabels}
      />

      {/* Active incidents map */}
      {mapPoints.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}
          >
            {t("sup_active_incidents")} ({mapPoints.length})
          </Text>
          <RouteMap
            points={mapPoints}
            height={220}
            initialCenter={mapPoints[0] ? { lat: mapPoints[0].lat, lon: mapPoints[0].lon, zoom: 9 } : undefined}
            onMarkerPress={(id) => setExpandedId((prev) => (prev === id ? null : id))}
          />
        </View>
      )}

      {/* Report list */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.cardMeta, { color: colors.mutedForeground, marginTop: 8 }]}>
            {t("my_reports_loading")}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={28} color="#DC2626" />
          <Text style={[styles.cardMeta, { color: "#DC2626", marginTop: 6 }]}>{error}</Text>
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="inbox" size={32} color={colors.mutedForeground} />
          <Text style={[styles.cardMeta, { color: colors.mutedForeground, marginTop: 8 }]}>
            {t("sup_no_reports")}
          </Text>
        </View>
      ) : (
        filteredReports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            expanded={expandedId === report.id}
            onToggle={() => setExpandedId((prev) => (prev === report.id ? null : report.id))}
            onUpdated={handleUpdated}
            colors={colors}
            isRTL={isRTL}
            token={token}
            statusLabels={statusLabels}
          />
        ))
      )}
    </ScrollView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  centered: { alignItems: "center", paddingVertical: 40 },
  guardCard: {
    width: "100%", maxWidth: 360, borderRadius: 16, borderWidth: 1, padding: 32,
    alignItems: "center", gap: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  heading: { fontSize: 20, fontWeight: "700" as const },
  sectionLabel: {
    fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.4,
    textTransform: "uppercase" as const, marginBottom: 8,
  },

  // Stats chips
  chipRow: { gap: 8, flexWrap: "nowrap" },
  statChip: {
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
    alignItems: "center", minWidth: 70,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  statChipCount: { fontSize: 20, fontWeight: "700" as const },
  statChipLabel: { fontSize: 10, fontWeight: "600" as const, marginTop: 2, textAlign: "center" },

  // Filter bar
  filterBar: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  filterHeader: { paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", gap: 8 },
  filterHeaderText: { flex: 1, fontSize: 14, fontWeight: "600" as const },
  filterBody: { paddingHorizontal: 14, paddingBottom: 12 },
  filterLabel: {
    fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase" as const,
    letterSpacing: 0.4, marginBottom: 6,
  },
  filterChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  filterChipText: { fontSize: 12, fontWeight: "600" as const },
  lateOnlyRow: { alignItems: "center", gap: 10, marginTop: 4 },
  toggle: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // Card
  card: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHeader: { alignItems: "flex-start", gap: 10 },
  catIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cardHeaderText: { flex: 1 },
  cardRef: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 0.3 },
  cardCat: { fontSize: 11, fontWeight: "600" as const, marginTop: 1 },
  badgeRow: { gap: 6, flexWrap: "wrap", alignItems: "center" },
  cardMeta: { fontSize: 12 },

  // Status pill
  statusPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.4 },

  // SLA chip
  slaChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  slaChipText: { fontSize: 11, fontWeight: "700" as const },

  // Escalation badge
  escalatedBadge: { borderRadius: 999, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#DC262644", paddingHorizontal: 8, paddingVertical: 3 },
  escalatedText: { fontSize: 10, fontWeight: "700" as const, color: "#DC2626", letterSpacing: 0.4 },

  // Thumbnail
  thumbnail: { width: "100%", height: 120, borderRadius: 10, marginTop: 10 },

  // Detail section
  detailSection: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  detailLabel: {
    fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase" as const,
    letterSpacing: 0.4, marginBottom: 4,
  },
  detailValue: { fontSize: 13, lineHeight: 20 },

  // Text input
  textInput: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 13, minHeight: 60, textAlignVertical: "top",
  },

  // Action button
  actionBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center", minHeight: 44 },
  actionBtnText: { fontSize: 14, fontWeight: "600" as const },

  // Divider
  divider: { height: 1 },

  // Resource dispatch
  dispatchDone: {
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dispatchDoneText: { fontSize: 13, fontWeight: "600" as const, flex: 1 },

  // Timeline
  timelineItem: { borderLeftWidth: 2, marginLeft: 6, paddingLeft: 12, paddingBottom: 12, gap: 4 },
  timelinePill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  timelinePillText: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 0.4 },
  timelineMeta: { fontSize: 11, marginTop: 2 },
  timelineNote: { fontSize: 12, marginTop: 2, lineHeight: 18 },
});
