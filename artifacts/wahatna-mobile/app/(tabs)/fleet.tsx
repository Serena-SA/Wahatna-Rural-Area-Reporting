import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { useLocation } from "@/context/LocationContext";
import { useColors } from "@/hooks/useColors";

type Kind = "start" | "stop" | "destination";

interface Stop {
  id: string;
  label: string;
  address?: string;
  lat: number;
  lon: number;
  kind: Kind;
}

interface OptimizedStop {
  order: number;
  label?: string;
  lat: number;
  lon: number;
  distance_to_next_km: number;
  original_index: number;
}
interface FleetResult {
  job_id: string;
  optimized_route: OptimizedStop[];
  metrics: {
    total_distance_km: number;
    initial_distance_km: number;
    improvement_pct: number;
    elapsed_ms: number;
  };
}

const UAE_PRESETS: Omit<Stop, "id">[] = [
  { label: "Dubai", address: "Dubai, UAE", lat: 25.2048, lon: 55.2708, kind: "start" },
  { label: "Sharjah", address: "Sharjah, UAE", lat: 25.3463, lon: 55.4209, kind: "stop" },
  { label: "Abu Dhabi", address: "Abu Dhabi, UAE", lat: 24.4539, lon: 54.3773, kind: "destination" },
];

const KIND_META: Record<Kind, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  start: { label: "Start", icon: "play" },
  stop: { label: "Stop", icon: "map-pin" },
  destination: { label: "End", icon: "flag" },
};

let idCounter = 0;
const newId = () => `s${Date.now()}_${idCounter++}`;
const kindRank = (k: Kind) => (k === "start" ? 0 : k === "destination" ? 2 : 1);

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * The backend returns a closed TSP tour. Reverse-traversing a tour preserves
 * its (optimal) length, so we re-present it as an OPEN path: rotate so the
 * user's start is first, then pick whichever of the two equivalent traversals
 * places the destination latest. Distances are recomputed per consecutive
 * pair (no cyclic wrap), and the terminal stop has no "distance to next".
 */
function orientRoute(
  route: OptimizedStop[],
  startOrigIdx: number,
  destOrigIdx: number
): OptimizedStop[] {
  if (route.length < 2) return route;
  let oriented = route;
  if (startOrigIdx >= 0) {
    const si = route.findIndex((r) => r.original_index === startOrigIdx);
    if (si > 0) oriented = [...route.slice(si), ...route.slice(0, si)];
  }
  if (destOrigIdx >= 0 && oriented.length > 2) {
    const reversed = [oriented[0], ...oriented.slice(1).reverse()];
    const diFwd = oriented.findIndex((r) => r.original_index === destOrigIdx);
    const diRev = reversed.findIndex((r) => r.original_index === destOrigIdx);
    if (diRev > diFwd) oriented = reversed;
  }
  return oriented.map((item, i) => ({
    ...item,
    order: i + 1,
    distance_to_next_km:
      i < oriented.length - 1 ? haversineKm(item, oriented[i + 1]) : 0,
  }));
}

export default function FleetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { lastLocation } = useLocation();

  const [stops, setStops] = useState<Stop[]>([]);
  const [submitted, setSubmitted] = useState<Stop[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState<FleetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kindColor = (k: Kind) =>
    k === "start" ? colors.success : k === "destination" ? colors.accent : colors.mutedForeground;

  const nextKind = (existing: Stop[]): Kind => {
    if (!existing.some((s) => s.kind === "start")) return "start";
    if (!existing.some((s) => s.kind === "destination")) return "destination";
    return "stop";
  };

  const runSearch = (q: string) => {
    setQuery(q);
    setSearchError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await geocode(q);
        setResults(r);
        if (r.length === 0) setSearchError("No places found");
      } catch (e: unknown) {
        setSearchError((e as Error).message || "Search failed");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
  };

  const addStop = (g: GeoResult) => {
    setStops((prev) => [
      ...prev,
      { id: newId(), label: g.label, address: g.address, lat: g.lat, lon: g.lon, kind: nextKind(prev) },
    ]);
    setQuery("");
    setResults([]);
    setSearchError("");
    setResult(null);
  };

  const addCurrentLocation = () => {
    if (!lastLocation) return;
    setStops((prev) => [
      ...prev,
      {
        id: newId(),
        label: "My Location",
        address: "Current GPS position",
        lat: lastLocation.lat,
        lon: lastLocation.lon,
        kind: nextKind(prev),
      },
    ]);
    setResult(null);
  };

  const loadPresets = () => {
    setStops(UAE_PRESETS.map((p) => ({ ...p, id: newId() })));
    setResult(null);
  };

  const removeStop = (id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
    setResult(null);
  };

  const setKind = (id: string, kind: Kind) => {
    setStops((prev) =>
      prev.map((s) => {
        if (s.id === id) return { ...s, kind };
        if (kind !== "stop" && s.kind === kind) return { ...s, kind: "stop" };
        return s;
      })
    );
    setResult(null);
  };

  const setLabel = (id: string, label: string) =>
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));

  const optimize = async () => {
    if (stops.length < 2) {
      setError("Add at least a start and a destination");
      return;
    }
    const starts = stops.filter((s) => s.kind === "start").length;
    const ends = stops.filter((s) => s.kind === "destination").length;
    if (starts !== 1) {
      setError("Mark exactly one location as the Start");
      return;
    }
    if (ends !== 1) {
      setError("Mark exactly one location as the End");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    fadeAnim.setValue(0);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const ordered = [...stops].sort((a, b) => kindRank(a.kind) - kindRank(b.kind));
      setSubmitted(ordered);
      const startOrigIdx = ordered.findIndex((s) => s.kind === "start");
      const destOrigIdx = ordered.findIndex((s) => s.kind === "destination");
      const payload = {
        waypoints: ordered.map((s) => ({ lat: s.lat, lon: s.lon, label: s.label })),
      };
      const res = await apiPost<FleetResult>("/fleet/optimize", payload, token);
      const oriented = orientRoute(res.optimized_route, startOrigIdx, destOrigIdx);
      const pathTotal = oriented.reduce((sum, s) => sum + s.distance_to_next_km, 0);
      setResult({
        ...res,
        optimized_route: oriented,
        metrics: { ...res.metrics, total_distance_km: pathTotal },
      });
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const mapData = useMemo(() => {
    if (result && result.optimized_route.length) {
      const pts: MapPoint[] = result.optimized_route.map((s) => ({
        lat: s.lat,
        lon: s.lon,
        label: s.label || `Stop ${s.order}`,
        kind: submitted[s.original_index]?.kind ?? "stop",
      }));
      const route = result.optimized_route.map((s) => [s.lat, s.lon] as [number, number]);
      return { pts, route };
    }
    const pts: MapPoint[] = stops.map((s) => ({
      lat: s.lat,
      lon: s.lon,
      label: s.label,
      kind: s.kind,
    }));
    return { pts, route: [] as [number, number][] };
  }, [result, stops, submitted]);

  const paddingBottom = insets.bottom + 90;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Map */}
        <RouteMap points={mapData.pts} route={mapData.route} height={260} />

        {/* Search / add location */}
        <GlassCard padding={14} style={{ gap: 10 }}>
          <View style={styles.headerRow}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PLAN ROUTE</Text>
            <Pressable onPress={loadPresets} style={[styles.presetBtn, { borderColor: colors.border }]}>
              <Text style={[styles.presetText, { color: colors.primary }]}>UAE Demo</Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search a place (e.g. Dubai Marina)"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={runSearch}
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {!!searchError && (
            <Text style={[styles.hintText, { color: colors.danger }]}>{searchError}</Text>
          )}

          {results.map((g, i) => (
            <Pressable
              key={`${g.lat}-${g.lon}-${i}`}
              onPress={() => addStop(g)}
              style={({ pressed }) => [
                styles.resultRow,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="map-pin" size={14} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultLabel, { color: colors.text }]} numberOfLines={1}>
                  {g.label}
                </Text>
                <Text style={[styles.resultAddr, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {g.address}
                </Text>
              </View>
              <Feather name="plus-circle" size={18} color={colors.primary} />
            </Pressable>
          ))}

          {lastLocation && (
            <Pressable
              onPress={addCurrentLocation}
              style={[styles.gpsRow, { borderColor: colors.border }]}
            >
              <Feather name="navigation" size={14} color={colors.primary} />
              <Text style={[styles.gpsText, { color: colors.primary }]}>Use my current location</Text>
            </Pressable>
          )}
        </GlassCard>

        {/* Location list (label + type + km frame) */}
        {stops.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="map" size={22} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Search for places to add your start, stops, and destination.
            </Text>
          </View>
        ) : (
          stops.map((s) => {
            const opt = result?.optimized_route.find((o) => submitted[o.original_index]?.id === s.id);
            return (
              <GlassCard key={s.id} padding={12} style={{ gap: 10 }}>
                <View style={styles.stopTopRow}>
                  <View style={[styles.kindDot, { backgroundColor: kindColor(s.kind) }]} />
                  <TextInput
                    style={[styles.labelInput, { color: colors.text, borderColor: colors.border }]}
                    value={s.label}
                    onChangeText={(v) => setLabel(s.id, v)}
                    placeholder="Label"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <Pressable onPress={() => removeStop(s.id)} hitSlop={8}>
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>

                {!!s.address && (
                  <Text style={[styles.addrText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {s.address}
                  </Text>
                )}

                <View style={styles.kindRow}>
                  {(Object.keys(KIND_META) as Kind[]).map((k) => {
                    const active = s.kind === k;
                    return (
                      <Pressable
                        key={k}
                        onPress={() => setKind(s.id, k)}
                        style={[
                          styles.kindBtn,
                          {
                            borderColor: active ? kindColor(k) : colors.border,
                            backgroundColor: active ? colors.surface2 : "transparent",
                          },
                        ]}
                      >
                        <Feather
                          name={KIND_META[k].icon}
                          size={12}
                          color={active ? kindColor(k) : colors.mutedForeground}
                        />
                        <Text
                          style={[
                            styles.kindBtnText,
                            { color: active ? colors.text : colors.mutedForeground },
                          ]}
                        >
                          {KIND_META[k].label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {opt && opt.distance_to_next_km > 0 && (
                    <View style={[styles.kmPill, { backgroundColor: colors.glowGreen }]}>
                      <Feather name="arrow-right" size={11} color={colors.primary} />
                      <Text style={[styles.kmText, { color: colors.primary }]}>
                        {opt.distance_to_next_km.toFixed(1)} km
                      </Text>
                    </View>
                  )}
                </View>
              </GlassCard>
            );
          })
        )}

        {!!error && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={13} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.optimizeBtn,
            { backgroundColor: colors.primary, opacity: loading || pressed ? 0.85 : 1 },
          ]}
          onPress={optimize}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="cpu" size={18} color={colors.primaryForeground} />
              <Text style={[styles.optimizeBtnText, { color: colors.primaryForeground }]}>
                OPTIMIZE ROUTE
              </Text>
            </>
          )}
        </Pressable>

        {result && (
          <Animated.View style={{ opacity: fadeAnim, gap: 10 }}>
            <GlassCard glowColor={colors.glowGreen} padding={14}>
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.primary }]}>
                    {result.metrics.total_distance_km != null
                      ? result.metrics.total_distance_km.toFixed(1)
                      : "0"}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>km total</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {result.metrics.improvement_pct != null
                      ? `${result.metrics.improvement_pct.toFixed(0)}%`
                      : "—"}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>shorter</Text>
                </View>
                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: colors.text }]}>
                    {result.metrics.elapsed_ms != null ? `${result.metrics.elapsed_ms}ms` : "—"}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>compute</Text>
                </View>
              </View>
            </GlassCard>

            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              OPTIMIZED ORDER
            </Text>

            {result.optimized_route.map((stop, i) => {
              const kind = submitted[stop.original_index]?.kind ?? "stop";
              return (
                <View key={i} style={styles.orderRow}>
                  <View style={[styles.stopNum, { backgroundColor: kindColor(kind) }]}>
                    <Text style={[styles.stopNumText, { color: colors.primaryForeground }]}>
                      {i + 1}
                    </Text>
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={[styles.stopLabel, { color: colors.text }]}>
                      {stop.label || `Stop ${i + 1}`}
                    </Text>
                    <Text style={[styles.stopKind, { color: colors.mutedForeground }]}>
                      {KIND_META[kind].label}
                    </Text>
                  </View>
                  {i < result.optimized_route.length - 1 && stop.distance_to_next_km > 0 && (
                    <View style={styles.kmPillSmall}>
                      <Feather name="arrow-down" size={11} color={colors.primary} />
                      <Text style={[styles.kmText, { color: colors.primary }]}>
                        {stop.distance_to_next_km.toFixed(1)} km
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            <View style={[styles.jobIdRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.jobId, { color: colors.mutedForeground }]}>
                Job #{result.job_id}
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.5 },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  presetText: { fontSize: 12, fontWeight: "600" as const },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, height: 38, fontSize: 14 },
  hintText: { fontSize: 12 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
  },
  resultLabel: { fontSize: 14, fontWeight: "600" as const },
  resultAddr: { fontSize: 11 },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  gpsText: { fontSize: 13, fontWeight: "600" as const },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: 13, textAlign: "center", maxWidth: 260 },
  stopTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  kindDot: { width: 12, height: 12, borderRadius: 6 },
  labelInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  addrText: { fontSize: 12, marginLeft: 22 },
  kindRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  kindBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  kindBtnText: { fontSize: 12, fontWeight: "600" as const },
  kmPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: "auto",
  },
  kmPillSmall: { flexDirection: "row", alignItems: "center", gap: 3 },
  kmText: { fontSize: 12, fontWeight: "700" as const },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
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
  metricsRow: { flexDirection: "row", alignItems: "center" },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 22, fontWeight: "800" as const },
  metricLabel: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.5 },
  metricDivider: { width: 1, height: 36 },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stopNum: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stopNumText: { fontSize: 13, fontWeight: "700" as const },
  stopInfo: { flex: 1 },
  stopLabel: { fontSize: 14, fontWeight: "600" as const },
  stopKind: { fontSize: 11 },
  jobIdRow: { borderTopWidth: 1, paddingTop: 10, alignItems: "flex-end" },
  jobId: { fontSize: 11 },
});
