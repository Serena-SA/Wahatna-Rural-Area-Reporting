import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "@/components/GlassCard";
import { RouteMap } from "@/components/RouteMap";
import { apiPost, geocode, type GeoResult } from "@/constants/api";
import type { MapPoint } from "@/constants/mapHtml";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

// ─── Types ───────────────────────────────────────────────────────────────────

type TransportMode = "walking" | "car" | "service_vehicle";
type GpsStatus = "loading" | "granted" | "denied";

interface WaypointItem {
  id: string;
  label: string;
  address?: string;
  lat: number;
  lon: number;
  priority: number; // 1–5
}

interface RouteStop {
  order: number;
  lat: number;
  lon: number;
  label: string;
  original_index: number;
  distance_to_next_km: number;
}

interface FleetResult {
  job_id: string;
  transport_mode: string;
  original_route: RouteStop[];
  optimized_route: RouteStop[];
  priority_explanation: string[];
  metrics: {
    original_distance_km: number;
    optimized_distance_km: number;
    distance_saved_km: number;
    original_time_min: number;
    optimized_time_min: number;
    time_saved_min: number;
    improvement_pct: number;
    speed_kmh: number;
    elapsed_ms: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let idCounter = 0;
const newId = () => `w${Date.now()}_${idCounter++}`;

const PRIORITY_LEVELS: { value: number; key: "fleet_priority_low" | "fleet_priority_medium" | "fleet_priority_high" | "fleet_priority_critical" }[] = [
  { value: 1, key: "fleet_priority_low" },
  { value: 2, key: "fleet_priority_medium" },
  { value: 4, key: "fleet_priority_high" },
  { value: 5, key: "fleet_priority_critical" },
];

function priorityColor(p: number, colors: ReturnType<typeof useColors>): string {
  if (p >= 5) return "#DC2626";
  if (p >= 4) return "#EA580C";
  if (p >= 2) return "#D97706";
  return colors.mutedForeground;
}

function fmtDist(km: number): string {
  return km.toFixed(1);
}

function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChipSelector<T extends string>({
  options,
  value,
  onSelect,
  colors,
}: {
  options: { key: T; label: string }[];
  value: T;
  onSelect: (k: T) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={chipStyles.row}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            style={[
              chipStyles.chip,
              {
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary + "22" : "transparent",
              },
            ]}
          >
            <Text
              style={[
                chipStyles.chipText,
                { color: active ? colors.primary : colors.mutedForeground },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "600" as const },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FleetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, isRTL } = useTranslation();
  const rowDir: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
  const textAlign: "left" | "right" = isRTL ? "right" : "left";

  // GPS start location
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("loading");
  const [gpsCoord, setGpsCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  // Transport mode
  const [transportMode, setTransportMode] = useState<TransportMode>("car");

  // Waypoints (destinations only)
  const [waypoints, setWaypoints] = useState<WaypointItem[]>([]);

  // Search
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimize
  const [result, setResult] = useState<FleetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Auto-detect GPS on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS === "web") {
      setGpsStatus("denied");
      return;
    }
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setGpsStatus("denied");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setGpsCoord({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsStatus("granted");
      } catch {
        setGpsStatus("denied");
      }
    })();
  }, []);

  // ── Search ────────────────────────────────────────────────────────────────

  const runSearch = useCallback((q: string) => {
    setQuery(q);
    setSearchError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await geocode(q);
        setSearchResults(r);
        if (r.length === 0) setSearchError(t("fleet_no_results"));
      } catch (e: unknown) {
        setSearchError((e as Error).message || t("err_generic"));
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
  }, [t]);

  const addWaypoint = useCallback((g: GeoResult) => {
    setWaypoints((prev) => [
      ...prev,
      { id: newId(), label: g.label, address: g.address, lat: g.lat, lon: g.lon, priority: 2 },
    ]);
    setQuery("");
    setSearchResults([]);
    setSearchError("");
    setResult(null);
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
    setResult(null);
  }, []);

  const setWaypointPriority = useCallback((id: string, priority: number) => {
    setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, priority } : w)));
    setResult(null);
  }, []);

  const setWaypointLabel = useCallback((id: string, label: string) => {
    setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, label } : w)));
  }, []);

  // ── Get effective start coord ─────────────────────────────────────────────

  const getStart = (): { lat: number; lon: number } | null => {
    if (gpsCoord) return gpsCoord;
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
    return null;
  };

  // ── Optimize ─────────────────────────────────────────────────────────────

  const handleOptimize = async () => {
    const start = getStart();
    if (!start) {
      setError(t("fleet_no_start"));
      return;
    }
    if (waypoints.length < 1) {
      setError(t("fleet_min_waypoints"));
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    fadeAnim.setValue(0);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const payload = {
        start: { lat: start.lat, lon: start.lon },
        waypoints: waypoints.map((w) => ({
          lat: w.lat,
          lon: w.lon,
          label: w.label,
          priority: w.priority,
        })),
        transport_mode: transportMode,
      };
      const res = await apiPost<FleetResult>("/fleet/optimize", payload, token);
      setResult(res);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError((e as Error).message || t("err_generic"));
    } finally {
      setLoading(false);
    }
  };

  // ── Map data ──────────────────────────────────────────────────────────────

  const mapPoints = useMemo<MapPoint[]>(() => {
    if (result) {
      const pts: MapPoint[] = [];
      const start = getStart();
      if (start) {
        pts.push({ lat: start.lat, lon: start.lon, label: t("fleet_start_location"), kind: "start" });
      }
      result.optimized_route.forEach((s) => {
        const origWp = waypoints[s.original_index];
        const p = origWp?.priority ?? 2;
        pts.push({
          lat: s.lat,
          lon: s.lon,
          label: `${s.order}. ${s.label}`,
          kind: "stop",
          color: p >= 5 ? "#DC2626" : p >= 4 ? "#EA580C" : "#2563EB",
        });
      });
      return pts;
    }
    const pts: MapPoint[] = [];
    const start = getStart();
    if (start) {
      pts.push({ lat: start.lat, lon: start.lon, label: t("fleet_start_location"), kind: "start" });
    }
    waypoints.forEach((w) => pts.push({ lat: w.lat, lon: w.lon, label: w.label, kind: "stop" }));
    return pts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, waypoints, gpsCoord]);

  const mapRoute = useMemo<[number, number][]>(() => {
    if (!result) return [];
    const start = getStart();
    const pts: [number, number][] = start ? [[start.lat, start.lon]] : [];
    result.optimized_route.forEach((s) => pts.push([s.lat, s.lon]));
    return pts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, gpsCoord]);

  // ── Transport mode options ────────────────────────────────────────────────

  const modeOptions: { key: TransportMode; label: string }[] = [
    { key: "walking", label: t("fleet_walking") },
    { key: "car", label: t("fleet_car") },
    { key: "service_vehicle", label: t("fleet_service_vehicle") },
  ];

  const priorityOptions = PRIORITY_LEVELS.map((p) => ({
    key: String(p.value) as string,
    label: t(p.key),
  }));

  const paddingBottom = insets.bottom + 90;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Map */}
        <RouteMap points={mapPoints} route={mapRoute} height={240} />

        {/* ── Start Location ── */}
        <GlassCard padding={14} style={{ gap: 10 }}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, textAlign }]}>
            {t("fleet_start_location").toUpperCase()}
          </Text>

          {gpsStatus === "loading" && (
            <View style={[styles.row, { flexDirection: rowDir, gap: 8 }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                {t("fleet_optimizing")}
              </Text>
            </View>
          )}

          {gpsStatus === "granted" && gpsCoord && (
            <View style={[styles.gpsChip, { backgroundColor: colors.glowGreen, flexDirection: rowDir }]}>
              <Feather name="navigation" size={14} color={colors.primary} />
              <Text style={[styles.gpsChipText, { color: colors.primary }]}>
                {t("fleet_using_gps")} · {gpsCoord.lat.toFixed(4)}°, {gpsCoord.lon.toFixed(4)}°
              </Text>
            </View>
          )}

          {gpsStatus === "denied" && (
            <View style={{ gap: 10 }}>
              <View style={[styles.row, { flexDirection: rowDir, gap: 6 }]}>
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={[styles.hintText, { color: colors.danger }]}>
                  {t("fleet_gps_denied")}
                </Text>
              </View>
              <Text style={[styles.hintText, { color: colors.mutedForeground, textAlign }]}>
                {t("fleet_gps_instructions")}
              </Text>
              <View style={[styles.coordRow, { flexDirection: rowDir, gap: 8 }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.coordLabel, { color: colors.mutedForeground, textAlign }]}>
                    {t("fleet_manual_lat")}
                  </Text>
                  <TextInput
                    style={[styles.coordInput, { color: colors.text, borderColor: colors.border }]}
                    value={manualLat}
                    onChangeText={setManualLat}
                    keyboardType="decimal-pad"
                    placeholder="24.1234"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.coordLabel, { color: colors.mutedForeground, textAlign }]}>
                    {t("fleet_manual_lon")}
                  </Text>
                  <TextInput
                    style={[styles.coordInput, { color: colors.text, borderColor: colors.border }]}
                    value={manualLon}
                    onChangeText={setManualLon}
                    keyboardType="decimal-pad"
                    placeholder="55.5678"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>
            </View>
          )}
        </GlassCard>

        {/* ── Transport Mode ── */}
        <GlassCard padding={14} style={{ gap: 10 }}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, textAlign }]}>
            {t("fleet_transport_mode").toUpperCase()}
          </Text>
          <ChipSelector
            options={modeOptions}
            value={transportMode}
            onSelect={(m) => { setTransportMode(m); setResult(null); }}
            colors={colors}
          />
          {transportMode === "walking" && (
            <View style={[styles.disclaimerRow, { flexDirection: rowDir, borderColor: colors.border }]}>
              <Feather name="info" size={13} color={colors.mutedForeground} />
              <Text style={[styles.disclaimerText, { color: colors.mutedForeground, textAlign }]}>
                {t("fleet_walking_disclaimer")}
              </Text>
            </View>
          )}
        </GlassCard>

        {/* ── Destination Waypoints ── */}
        <GlassCard padding={14} style={{ gap: 10 }}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground, textAlign }]}>
            {t("fleet_add_waypoint").toUpperCase()}
          </Text>

          {/* Search */}
          <View style={[styles.searchRow, { flexDirection: rowDir }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t("fleet_add_waypoint") + "…"}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={runSearch}
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {!!searchError && (
            <Text style={[styles.hintText, { color: colors.danger, textAlign }]}>{searchError}</Text>
          )}

          {searchResults.map((g, i) => (
            <Pressable
              key={`${g.lat}-${g.lon}-${i}`}
              onPress={() => addWaypoint(g)}
              style={({ pressed }) => [
                styles.resultRow,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1, flexDirection: rowDir },
              ]}
            >
              <Feather name="map-pin" size={14} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultLabel, { color: colors.text, textAlign }]} numberOfLines={1}>
                  {g.label}
                </Text>
                <Text style={[styles.resultAddr, { color: colors.mutedForeground, textAlign }]} numberOfLines={1}>
                  {g.address}
                </Text>
              </View>
              <Feather name="plus-circle" size={18} color={colors.primary} />
            </Pressable>
          ))}
        </GlassCard>

        {/* ── Waypoint list with priority ── */}
        {waypoints.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="map" size={22} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>
              {t("fleet_min_waypoints")}
            </Text>
          </View>
        ) : (
          waypoints.map((w, idx) => (
            <GlassCard key={w.id} padding={12} style={{ gap: 10 }}>
              {/* Label row */}
              <View style={[styles.wpTopRow, { flexDirection: rowDir }]}>
                <View style={[styles.wpBadge, { backgroundColor: priorityColor(w.priority, colors) + "22" }]}>
                  <Text style={[styles.wpBadgeText, { color: priorityColor(w.priority, colors) }]}>
                    {idx + 1}
                  </Text>
                </View>
                <TextInput
                  style={[styles.labelInput, { color: colors.text, borderColor: colors.border, flex: 1 }]}
                  value={w.label}
                  onChangeText={(v) => setWaypointLabel(w.id, v)}
                  placeholder="Label"
                  placeholderTextColor={colors.mutedForeground}
                />
                <Pressable onPress={() => removeWaypoint(w.id)} hitSlop={8}>
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {!!w.address && (
                <Text style={[styles.addrText, { color: colors.mutedForeground, textAlign }]} numberOfLines={1}>
                  {w.address}
                </Text>
              )}

              {/* Priority selector */}
              <View style={[styles.priorityRow, { flexDirection: rowDir }]}>
                <Text style={[styles.priorityLabel, { color: colors.mutedForeground }]}>
                  {t("fleet_priority")}:
                </Text>
                {PRIORITY_LEVELS.map((pl) => {
                  const active = w.priority === pl.value;
                  const pColor = priorityColor(pl.value, colors);
                  return (
                    <Pressable
                      key={pl.value}
                      onPress={() => setWaypointPriority(w.id, pl.value)}
                      style={[
                        styles.priorityBtn,
                        {
                          borderColor: active ? pColor : colors.border,
                          backgroundColor: active ? pColor + "22" : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={[styles.priorityBtnText, { color: active ? pColor : colors.mutedForeground }]}
                      >
                        {t(pl.key)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          ))
        )}

        {!!error && (
          <View style={[styles.errorRow, { flexDirection: rowDir }]}>
            <Feather name="alert-circle" size={13} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        {/* ── Optimize button ── */}
        <Pressable
          style={({ pressed }) => [
            styles.optimizeBtn,
            { backgroundColor: colors.primary, opacity: loading || pressed ? 0.85 : 1 },
          ]}
          onPress={handleOptimize}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="cpu" size={18} color={colors.primaryForeground} />
              <Text style={[styles.optimizeBtnText, { color: colors.primaryForeground }]}>
                {t("fleet_optimize").toUpperCase()}
              </Text>
            </>
          )}
        </Pressable>

        {/* ── Results ── */}
        {result && (
          <Animated.View style={{ opacity: fadeAnim, gap: 12 }}>

            {/* Savings metrics banner */}
            <GlassCard glowColor={colors.glowGreen} padding={14}>
              <View style={[styles.metricsRow, { flexDirection: rowDir }]}>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.primary }]}>
                    {fmtDist(result.metrics.distance_saved_km)}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                    km {t("fleet_distance_saved").toLowerCase()}
                  </Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {fmtTime(result.metrics.time_saved_min)}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                    {t("fleet_time_saved")}
                  </Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {result.metrics.improvement_pct.toFixed(0)}%
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                    shorter
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Priority callout */}
            {result.priority_explanation.length > 0 && (
              <View style={[styles.priorityCallout, { backgroundColor: "#DC262622", borderColor: "#DC2626" }]}>
                <Feather name="alert-triangle" size={14} color="#DC2626" />
                <Text style={[styles.priorityCalloutText, { color: "#DC2626", textAlign }]}>
                  {t("fleet_priority_note")}
                  {result.priority_explanation.length > 0 ? `: ${result.priority_explanation.join(", ")}` : ""}
                </Text>
              </View>
            )}

            {/* Two-panel comparison */}
            <View style={[styles.comparisonRow, { flexDirection: rowDir }]}>
              {/* Original Order panel */}
              <View style={[styles.compPanel, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.compHeader, { color: colors.mutedForeground }]}>
                  {t("fleet_original_order").toUpperCase()}
                </Text>
                <Text style={[styles.compDist, { color: colors.text }]}>
                  {fmtDist(result.metrics.original_distance_km)} km
                </Text>
                <Text style={[styles.compTime, { color: colors.mutedForeground }]}>
                  ~{fmtTime(result.metrics.original_time_min)}
                </Text>
                <View style={styles.compStops}>
                  {result.original_route.map((stop, i) => (
                    <View key={i} style={[styles.compStopRow, { flexDirection: rowDir }]}>
                      <View style={[styles.compDot, { backgroundColor: colors.mutedForeground }]} />
                      <Text style={[styles.compStopLabel, { color: colors.text }]} numberOfLines={1}>
                        {stop.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Optimized Route panel */}
              <View style={[styles.compPanel, { borderColor: colors.primary + "66", backgroundColor: colors.card }]}>
                <Text style={[styles.compHeader, { color: colors.primary }]}>
                  {t("fleet_optimized_route").toUpperCase()}
                </Text>
                <Text style={[styles.compDist, { color: colors.primary }]}>
                  {fmtDist(result.metrics.optimized_distance_km)} km
                </Text>
                <Text style={[styles.compTime, { color: colors.mutedForeground }]}>
                  ~{fmtTime(result.metrics.optimized_time_min)}
                </Text>
                <View style={styles.compStops}>
                  {result.optimized_route.map((stop, i) => {
                    const origWp = waypoints[stop.original_index];
                    const p = origWp?.priority ?? 2;
                    return (
                      <View key={i} style={[styles.compStopRow, { flexDirection: rowDir }]}>
                        <View style={[styles.compDot, { backgroundColor: priorityColor(p, colors) }]} />
                        <Text style={[styles.compStopLabel, { color: colors.text }]} numberOfLines={1}>
                          {stop.label}
                        </Text>
                        {stop.distance_to_next_km > 0 && (
                          <Text style={[styles.compKm, { color: colors.mutedForeground }]}>
                            {stop.distance_to_next_km.toFixed(1)} km
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Job ID */}
            <Text style={[styles.jobId, { color: colors.mutedForeground, textAlign }]}>
              Job #{result.job_id} · {result.transport_mode} · {result.metrics.speed_kmh} km/h
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionTitle: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.5 },
  row: { alignItems: "center" },
  hintText: { fontSize: 12 },
  gpsChip: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  gpsChipText: { fontSize: 13, fontWeight: "600" as const, flexShrink: 1 },
  coordRow: { alignItems: "flex-end" },
  coordLabel: { fontSize: 11, fontWeight: "600" as const },
  coordInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  disclaimerRow: {
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  disclaimerText: { fontSize: 11, flex: 1 },
  searchRow: { alignItems: "center", gap: 8 },
  searchInput: { flex: 1, height: 38, fontSize: 14 },
  resultRow: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
  },
  resultLabel: { fontSize: 14, fontWeight: "600" as const },
  resultAddr: { fontSize: 11 },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: 13, maxWidth: 260 },
  wpTopRow: { alignItems: "center", gap: 10 },
  wpBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  wpBadgeText: { fontSize: 13, fontWeight: "700" as const },
  labelInput: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  addrText: { fontSize: 12, marginLeft: 38 },
  priorityRow: { alignItems: "center", gap: 6, flexWrap: "wrap" },
  priorityLabel: { fontSize: 11, fontWeight: "600" as const },
  priorityBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  priorityBtnText: { fontSize: 11, fontWeight: "600" as const },
  errorRow: { alignItems: "center", gap: 6 },
  errorText: { fontSize: 13 },
  optimizeBtn: {
    height: 54,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "rgba(109,179,63,0.5)",
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  optimizeBtnText: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 1.5 },
  metricsRow: { alignItems: "center" },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 20, fontWeight: "800" as const },
  metricLabel: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.5, textAlign: "center" },
  metricDivider: { width: 1, height: 36 },
  priorityCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  priorityCalloutText: { fontSize: 12, flex: 1, fontWeight: "600" as const },
  comparisonRow: { gap: 10 },
  compPanel: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    minWidth: 140,
  },
  compHeader: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1 },
  compDist: { fontSize: 18, fontWeight: "800" as const },
  compTime: { fontSize: 11 },
  compStops: { marginTop: 8, gap: 4 },
  compStopRow: { alignItems: "center", gap: 6 },
  compDot: { width: 8, height: 8, borderRadius: 4 },
  compStopLabel: { fontSize: 11, flex: 1 },
  compKm: { fontSize: 10 },
  jobId: { fontSize: 10 },
});
