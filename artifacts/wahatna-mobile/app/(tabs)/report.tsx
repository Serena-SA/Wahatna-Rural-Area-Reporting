import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { fetch as expoFetch } from "expo/fetch";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { SeverityBadge } from "@/components/SeverityBadge";
import { geocode, type GeoResult } from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";
import { useOfflineQueue } from "@/context/OfflineQueueContext";
import { useNetworkState } from "@/hooks/useNetworkState";
import { useColors } from "@/hooks/useColors";

// ─── types ───────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4;
type Phase = "wizard" | "submitting" | "confirmed";
type LocationSource = "gps" | "address";
type GpsState = "idle" | "fetching" | "ok" | "denied";

interface SubmitResult {
  incident_id: number;
  reference: string;
  due_at: string;
  score_awarded?: number;
  assessment?: { risk_level?: string };
}

// ─── categories ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "fire",        icon: "alert-triangle" as const, color: "#DC2626" },
  { key: "flood",       icon: "droplet" as const,        color: "#2563EB" },
  { key: "road_damage", icon: "navigation" as const,     color: "#D97706" },
  { key: "electrical",  icon: "zap" as const,            color: "#CA8A04" },
  { key: "heat_stress", icon: "thermometer" as const,    color: "#EA580C" },
  { key: "waste",       icon: "trash-2" as const,        color: "#7C3AED" },
  { key: "structural",  icon: "home" as const,           color: "#6B7280" },
  { key: "other",       icon: "more-horizontal" as const, color: "#6B7280" },
];

const EMERGENCY_CATS = new Set(["fire", "electrical", "structural"]);

// ─── step progress indicator ─────────────────────────────────────────────────

function StepDots({ current, total, color }: { current: WizardStep; total: number; color: string }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i + 1 <= current ? color : "#E5E7EB",
              width: i + 1 === current ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, isRTL } = useTranslation();
  const { addToQueue } = useOfflineQueue();
  const { isOnline } = useNetworkState();

  const row: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
  const textAlign: "left" | "right" = isRTL ? "right" : "left";

  // ── step 1 ────────────────────────────────────────────────
  const [category, setCategory] = useState("fire");
  const [description, setDescription] = useState("");
  const [phonePrimary, setPhonePrimary] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");

  // ── step 2 ────────────────────────────────────────────────
  const [locationSource, setLocationSource] = useState<LocationSource>("gps");
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLon, setGpsLon] = useState<number | null>(null);
  const [addressText, setAddressText] = useState("");
  const [addressResults, setAddressResults] = useState<GeoResult[]>([]);
  const [selectedGeo, setSelectedGeo] = useState<GeoResult | null>(null);
  const [addressSearching, setAddressSearching] = useState(false);

  // ── step 3 ────────────────────────────────────────────────
  const [photos, setPhotos] = useState<string[]>([]);

  // ── wizard state ──────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>(1);
  const [phase, setPhase] = useState<Phase>("wizard");
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");

  const paddingBottom = insets.bottom + 100;
  const paddingTop = insets.top + (Platform.OS === "web" ? 67 : 0) + 8;

  // ── GPS auto-fetch on step 2 ──────────────────────────────
  useEffect(() => {
    if (step !== 2 || gpsState !== "idle") return;
    void tryGPS();
  }, [step]);

  async function tryGPS() {
    if (Platform.OS === "web") {
      setGpsState("denied");
      setLocationSource("address");
      return;
    }
    setGpsState("fetching");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsState("denied");
        setLocationSource("address");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setGpsLat(pos.coords.latitude);
      setGpsLon(pos.coords.longitude);
      setGpsState("ok");
      setLocationSource("gps");
    } catch {
      setGpsState("denied");
      setLocationSource("address");
    }
  }

  async function searchAddress() {
    if (!addressText.trim()) return;
    setAddressSearching(true);
    setAddressResults([]);
    try {
      const results = await geocode(addressText.trim());
      setAddressResults(results.slice(0, 5));
    } catch {
      setAddressResults([]);
    } finally {
      setAddressSearching(false);
    }
  }

  // ── photo helpers ─────────────────────────────────────────
  async function pickFromLibrary() {
    if (photos.length >= 3) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) {
      setPhotos(prev => [...prev, res.assets[0]!.uri].slice(0, 3));
    }
  }

  async function takePhoto() {
    if (photos.length >= 3) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      setPhotos(prev => [...prev, res.assets[0]!.uri].slice(0, 3));
    }
  }

  function removePhoto(uri: string) {
    setPhotos(prev => prev.filter(p => p !== uri));
  }

  // ── validation per step ───────────────────────────────────
  function validate(s: WizardStep): string | null {
    if (s === 1) {
      if (!description.trim()) return t("report_description_label") + " required";
      if (description.trim().length < 20) return t("report_description_min");
      if (!phonePrimary.trim()) return t("report_phone_primary") + " required";
    }
    if (s === 2) {
      const lat = locationSource === "gps" ? gpsLat : selectedGeo?.lat ?? null;
      const lon = locationSource === "gps" ? gpsLon : selectedGeo?.lon ?? null;
      if (lat == null || lon == null) return t("err_location");
    }
    return null;
  }

  function nextStep() {
    const err = validate(step);
    if (err) { setError(err); return; }
    setError("");
    if (step < 4) setStep((step + 1) as WizardStep);
  }

  function prevStep() {
    setError("");
    if (step > 1) setStep((step - 1) as WizardStep);
  }

  // ── submit ────────────────────────────────────────────────
  async function submit() {
    setError("");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const lat = locationSource === "gps" ? gpsLat! : selectedGeo!.lat;
    const lon = locationSource === "gps" ? gpsLon! : selectedGeo!.lon;
    const addrDetails = locationSource === "address"
      ? (selectedGeo?.address ?? addressText)
      : undefined;

    if (!isOnline) {
      const { duplicate } = await addToQueue({
        lat,
        lon,
        reportText: description.trim(),
        category,
        imageUri: photos[0],
        phone_primary: phonePrimary.trim() || undefined,
        phone_secondary: phoneSecondary.trim() || undefined,
        address_details: addrDetails,
        location_source: locationSource,
      });

      if (duplicate) {
        Alert.alert(
          t("home_safety"),
          duplicate.message,
          [
            { text: t("report_back"), style: "cancel" },
            {
              text: t("report_submit"),
              onPress: () => {
                setSubmitResult(null);
                setPhase("confirmed");
              },
            },
          ],
        );
        return;
      }
      setSubmitResult(null);
      setPhase("confirmed");
      return;
    }

    setPhase("submitting");
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const base = domain ? `https://${domain}/api` : "http://localhost:8080/api";

    try {
      const formData = new FormData();
      formData.append("lat", String(lat));
      formData.append("lon", String(lon));
      formData.append("report_text", description.trim());
      formData.append("category", category);
      formData.append("phone_primary", phonePrimary.trim());
      if (phoneSecondary.trim()) formData.append("phone_secondary", phoneSecondary.trim());
      if (addrDetails) formData.append("address_details", addrDetails);
      formData.append("location_source", locationSource);

      if (photos[0]) {
        const uri = photos[0];
        const ext = (uri.split(".").pop()?.split("?")[0] ?? "jpg").toLowerCase();
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
        if (Platform.OS === "web") {
          try {
            const blob = await (await fetch(uri)).blob();
            formData.append("image", blob, `hazard.${safeExt}`);
          } catch {}
        } else {
          formData.append("image", { uri, name: `hazard.${safeExt}`, type: `image/${safeExt}` } as unknown as Blob);
        }
      }

      const res = await expoFetch(`${base}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as SubmitResult;
      setSubmitResult(data);
      setPhase("confirmed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError((e as Error).message || t("err_generic"));
      setPhase("wizard");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function reset() {
    setStep(1);
    setPhase("wizard");
    setCategory("fire");
    setDescription("");
    setPhonePrimary("");
    setPhoneSecondary("");
    setGpsState("idle");
    setGpsLat(null);
    setGpsLon(null);
    setAddressText("");
    setAddressResults([]);
    setSelectedGeo(null);
    setPhotos([]);
    setSubmitResult(null);
    setError("");
  }

  // ── confirmed screen ──────────────────────────────────────
  if (phase === "confirmed") {
    const isOfflineQueue = !submitResult;
    const ref = submitResult?.reference ?? null;
    const dueAt = submitResult?.due_at ?? null;
    const riskLevel = submitResult?.assessment?.risk_level ?? "medium";

    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.confirmedContainer,
          { paddingTop: paddingTop + 16, paddingBottom: paddingBottom },
        ]}
      >
        <View
          style={[
            styles.checkCircle,
            { backgroundColor: isOfflineQueue ? "#FEF3C7" : "#F0FDF4" },
          ]}
        >
          <Feather
            name={isOfflineQueue ? "clock" : "check-circle"}
            size={48}
            color={isOfflineQueue ? "#D97706" : "#16A34A"}
          />
        </View>

        <Text style={[styles.confirmTitle, { color: colors.text, textAlign: "center" }]}>
          {isOfflineQueue ? t("offline_will_submit") : t("confirm_title")}
        </Text>

        {!isOfflineQueue && (
          <Text style={[styles.confirmBody, { color: colors.mutedForeground, textAlign: "center" }]}>
            {t("confirm_body")}
          </Text>
        )}

        {ref && (
          <GlassCard style={{ width: "100%" }} padding={20}>
            <View style={[styles.confirmRow, { flexDirection: row }]}>
              <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>
                {t("confirm_reference")}
              </Text>
              <Text style={[styles.confirmValue, { color: colors.primary }]}>{ref}</Text>
            </View>
            <View style={[styles.confirmRow, { flexDirection: row, marginTop: 12 }]}>
              <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>
                {t("confirm_status")}
              </Text>
              <SeverityBadge level="low" size="sm" />
            </View>
            {dueAt && (
              <View style={[styles.confirmRow, { flexDirection: row, marginTop: 12 }]}>
                <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>
                  {t("confirm_expected")}
                </Text>
                <Text style={[styles.confirmValue, { color: colors.text }]}>
                  {new Date(dueAt).toLocaleString(isRTL ? "ar-AE" : "en-AE", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
          </GlassCard>
        )}

        <Pressable
          style={[styles.trackBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/my-reports")}
        >
          <Text style={[styles.trackBtnText, { color: colors.primaryForeground }]}>
            {t("confirm_track")}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.anotherBtn, { borderColor: colors.border }]}
          onPress={reset}
        >
          <Text style={[styles.anotherBtnText, { color: colors.text }]}>
            {t("confirm_another")}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── submitting spinner ────────────────────────────────────
  if (phase === "submitting") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.submittingText, { color: colors.mutedForeground }]}>
          {t("report_submitting")}
        </Text>
      </View>
    );
  }

  // ── wizard ────────────────────────────────────────────────
  const currentCat = CATEGORIES.find(c => c.key === category)!;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Progress header */}
      <View
        style={[
          styles.progressHeader,
          { paddingTop: paddingTop, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          {step === 1 && t("report_step_category")}
          {step === 2 && t("report_step_location")}
          {step === 3 && t("report_step_photos")}
          {step === 4 && t("report_step_review")}
        </Text>
        <StepDots current={step} total={4} color={colors.primary} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── STEP 1: Category + Details ─────────────────── */}
        {step === 1 && (
          <>
            {/* Category grid */}
            <Text style={[styles.label, { color: colors.mutedForeground, textAlign }]}>
              {t("report_category_label")}
            </Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(cat => (
                <Pressable
                  key={cat.key}
                  onPress={() => { setCategory(cat.key); Haptics.selectionAsync(); }}
                  style={[
                    styles.catBtn,
                    {
                      backgroundColor: category === cat.key ? `${cat.color}18` : colors.surface2,
                      borderColor: category === cat.key ? cat.color : colors.border,
                      flexDirection: row,
                    },
                  ]}
                >
                  <Feather
                    name={cat.icon}
                    size={18}
                    color={category === cat.key ? cat.color : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.catLabel,
                      { color: category === cat.key ? cat.color : colors.mutedForeground },
                    ]}
                  >
                    {t(`cat_${cat.key}` as never)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Description */}
            <Text style={[styles.label, { color: colors.mutedForeground, textAlign }]}>
              {t("report_description_label")}
            </Text>
            <View style={[styles.textAreaWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textArea, { color: colors.text, textAlign }]}
                placeholder={t("report_description_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { color: description.length < 20 ? colors.danger : colors.mutedForeground }]}>
                {description.length}/20+
              </Text>
            </View>

            {/* Phones */}
            <Text style={[styles.label, { color: colors.mutedForeground, textAlign }]}>
              {t("report_phone_primary")}
            </Text>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.surface2, borderColor: colors.border, flexDirection: row },
              ]}
            >
              <Feather name="phone" size={16} color={colors.mutedForeground} style={isRTL ? styles.iconRTL : styles.iconLTR} />
              <TextInput
                style={[styles.input, { color: colors.text, textAlign }]}
                placeholder={t("report_phone_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                value={phonePrimary}
                onChangeText={setPhonePrimary}
              />
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground, textAlign }]}>
              {t("report_phone_secondary")}
            </Text>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.surface2, borderColor: colors.border, flexDirection: row },
              ]}
            >
              <Feather name="phone" size={16} color={colors.mutedForeground} style={isRTL ? styles.iconRTL : styles.iconLTR} />
              <TextInput
                style={[styles.input, { color: colors.text, textAlign }]}
                placeholder={t("report_phone_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                value={phoneSecondary}
                onChangeText={setPhoneSecondary}
              />
            </View>
          </>
        )}

        {/* ── STEP 2: Location ───────────────────────────── */}
        {step === 2 && (
          <>
            {/* Source toggle */}
            <View style={[styles.sourceToggle, { flexDirection: row }]}>
              {(["gps", "address"] as LocationSource[]).map(src => (
                <Pressable
                  key={src}
                  onPress={() => setLocationSource(src)}
                  style={[
                    styles.sourceBtn,
                    {
                      backgroundColor: locationSource === src ? colors.primary : colors.surface2,
                      borderColor: locationSource === src ? colors.primary : colors.border,
                      flex: 1,
                      flexDirection: row,
                    },
                  ]}
                >
                  <Feather
                    name={src === "gps" ? "map-pin" : "search"}
                    size={14}
                    color={locationSource === src ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.sourceBtnText,
                      { color: locationSource === src ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {src === "gps" ? t("loc_source_gps") : t("loc_source_address")}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* GPS panel */}
            {locationSource === "gps" && (
              <GlassCard padding={16}>
                {gpsState === "fetching" && (
                  <View style={[styles.gpsFetching, { flexDirection: row }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.gpsText, { color: colors.mutedForeground }]}>
                      {t("loc_using_gps")}…
                    </Text>
                  </View>
                )}
                {gpsState === "ok" && gpsLat != null && gpsLon != null && (
                  <View style={[styles.gpsOk, { flexDirection: row }]}>
                    <Feather name="check-circle" size={18} color={colors.success} />
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={[styles.gpsOkText, { color: colors.text, textAlign }]}>
                        {t("loc_using_gps")}
                      </Text>
                      <Text style={[styles.gpsCoords, { color: colors.mutedForeground, textAlign }]}>
                        {gpsLat.toFixed(5)}, {gpsLon.toFixed(5)}
                      </Text>
                    </View>
                    <Pressable onPress={tryGPS}>
                      <Feather name="refresh-cw" size={16} color={colors.primary} />
                    </Pressable>
                  </View>
                )}
                {gpsState === "denied" && (
                  <View style={styles.gpsDenied}>
                    <Feather name="alert-circle" size={18} color={colors.warning} />
                    <Text style={[styles.gpsDeniedText, { color: colors.text, textAlign }]}>
                      {Platform.OS === "ios"
                        ? t("loc_gps_denied_ios")
                        : Platform.OS === "android"
                          ? t("loc_gps_denied_android")
                          : t("loc_gps_denied_web")}
                    </Text>
                  </View>
                )}
              </GlassCard>
            )}

            {/* Address panel */}
            {locationSource === "address" && (
              <GlassCard padding={16} style={{ gap: 12 }}>
                <View style={[styles.searchRow, { flexDirection: row }]}>
                  <View
                    style={[
                      styles.inputWrap,
                      { flex: 1, backgroundColor: colors.surface2, borderColor: colors.border, flexDirection: row },
                    ]}
                  >
                    <Feather
                      name="search"
                      size={16}
                      color={colors.mutedForeground}
                      style={isRTL ? styles.iconRTL : styles.iconLTR}
                    />
                    <TextInput
                      style={[styles.input, { color: colors.text, textAlign }]}
                      placeholder={t("loc_address_placeholder")}
                      placeholderTextColor={colors.mutedForeground}
                      value={addressText}
                      onChangeText={setAddressText}
                      onSubmitEditing={searchAddress}
                      returnKeyType="search"
                    />
                  </View>
                  <Pressable
                    style={[styles.searchBtn, { backgroundColor: colors.primary }]}
                    onPress={searchAddress}
                    disabled={addressSearching}
                  >
                    {addressSearching
                      ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                      : <Feather name="search" size={16} color={colors.primaryForeground} />}
                  </Pressable>
                </View>

                {addressResults.length > 0 && (
                  <View style={[styles.resultsList, { borderColor: colors.border }]}>
                    {addressResults.map((geo, i) => (
                      <Pressable
                        key={i}
                        onPress={() => {
                          setSelectedGeo(geo);
                          setAddressResults([]);
                          setAddressText(geo.label);
                        }}
                        style={[
                          styles.resultItem,
                          {
                            borderBottomColor: colors.border,
                            borderBottomWidth: i < addressResults.length - 1 ? 1 : 0,
                            flexDirection: row,
                          },
                        ]}
                      >
                        <Feather name="map-pin" size={14} color={colors.primary} style={isRTL ? styles.iconRTL : styles.iconLTR} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.resultLabel, { color: colors.text, textAlign }]}>
                            {geo.label}
                          </Text>
                          <Text style={[styles.resultAddress, { color: colors.mutedForeground, textAlign }]}>
                            {geo.address}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

                {selectedGeo && (
                  <View style={[styles.selectedGeo, { flexDirection: row, backgroundColor: colors.secondary, borderColor: colors.primary + "33" }]}>
                    <Feather name="check-circle" size={16} color={colors.primary} />
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={[styles.selectedGeoText, { color: colors.text, textAlign }]}>
                        {selectedGeo.label}
                      </Text>
                      <Text style={[styles.selectedGeoCoords, { color: colors.mutedForeground, textAlign }]}>
                        {selectedGeo.lat.toFixed(4)}, {selectedGeo.lon.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                )}
              </GlassCard>
            )}
          </>
        )}

        {/* ── STEP 3: Photos ─────────────────────────────── */}
        {step === 3 && (
          <>
            <Text style={[styles.photoHint, { color: colors.mutedForeground, textAlign }]}>
              {t("report_photos_optional")}
            </Text>

            {/* Photo thumbnails */}
            {photos.length > 0 && (
              <View style={[styles.thumbRow, { flexDirection: row }]}>
                {photos.map(uri => (
                  <View key={uri} style={styles.thumbWrap}>
                    <Image source={{ uri }} style={styles.thumb} />
                    <Pressable
                      style={styles.thumbRemove}
                      onPress={() => removePhoto(uri)}
                    >
                      <Feather name="x" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {photos.length < 3 && (
              <View style={[styles.photoButtons, { flexDirection: row }]}>
                <Pressable
                  style={[styles.photoBtn, { borderColor: colors.primary, backgroundColor: colors.secondary, flex: 1 }]}
                  onPress={takePhoto}
                >
                  <Feather name="camera" size={20} color={colors.primary} />
                  <Text style={[styles.photoBtnText, { color: colors.primary }]}>
                    {t("report_take_photo")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.photoBtn, { borderColor: colors.border, backgroundColor: colors.surface2, flex: 1 }]}
                  onPress={pickFromLibrary}
                >
                  <Feather name="image" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.photoBtnText, { color: colors.mutedForeground }]}>
                    {t("report_choose_library")}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* ── STEP 4: Review + Submit ─────────────────────── */}
        {step === 4 && (
          <>
            {/* Offline warning */}
            {!isOnline && (
              <View style={[styles.offlineBanner, { flexDirection: row }]}>
                <Feather name="wifi-off" size={15} color="#B45309" />
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={[styles.offlineBannerText, { color: "#B45309", textAlign }]}>
                    {t("offline_will_submit")}
                  </Text>
                  {EMERGENCY_CATS.has(category) && (
                    <Text style={[styles.emergencyNote, { textAlign }]}>
                      {t("offline_emergency_warning")}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Summary */}
            <GlassCard padding={18}>
              <Text style={[styles.summaryTitle, { color: colors.mutedForeground, textAlign }]}>
                {t("report_step_review")}
              </Text>

              <View style={[styles.summaryRow, { flexDirection: row, borderBottomColor: colors.border }]}>
                <Feather name={currentCat.icon} size={16} color={currentCat.color} style={isRTL ? styles.iconRTL : styles.iconLTR} />
                <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>{t("report_category_label")}</Text>
                <Text style={[styles.summaryVal, { color: colors.text }]}>{t(`cat_${category}` as never)}</Text>
              </View>

              <View style={[styles.summaryRow, { flexDirection: row, borderBottomColor: colors.border }]}>
                <Feather name="align-left" size={16} color={colors.mutedForeground} style={isRTL ? styles.iconRTL : styles.iconLTR} />
                <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>{t("report_description_label")}</Text>
                <Text style={[styles.summaryVal, { color: colors.text }]} numberOfLines={2}>
                  {description.slice(0, 80)}{description.length > 80 ? "…" : ""}
                </Text>
              </View>

              <View style={[styles.summaryRow, { flexDirection: row, borderBottomColor: colors.border }]}>
                <Feather name="map-pin" size={16} color={colors.mutedForeground} style={isRTL ? styles.iconRTL : styles.iconLTR} />
                <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>
                  {locationSource === "gps" ? t("loc_source_gps") : t("loc_source_address")}
                </Text>
                <Text style={[styles.summaryVal, { color: colors.text }]}>
                  {locationSource === "gps"
                    ? `${gpsLat?.toFixed(4)}, ${gpsLon?.toFixed(4)}`
                    : selectedGeo?.label ?? addressText}
                </Text>
              </View>

              <View style={[styles.summaryRow, { flexDirection: row, borderBottomColor: colors.border }]}>
                <Feather name="phone" size={16} color={colors.mutedForeground} style={isRTL ? styles.iconRTL : styles.iconLTR} />
                <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>{t("report_phone_primary")}</Text>
                <Text style={[styles.summaryVal, { color: colors.text }]}>{phonePrimary || "—"}</Text>
              </View>

              <View style={[styles.summaryRow, { flexDirection: row, borderBottomColor: "transparent" }]}>
                <Feather name="camera" size={16} color={colors.mutedForeground} style={isRTL ? styles.iconRTL : styles.iconLTR} />
                <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>Photos</Text>
                <Text style={[styles.summaryVal, { color: colors.text }]}>{photos.length}</Text>
              </View>
            </GlassCard>

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={submit}
            >
              <Feather name="send" size={18} color={colors.primaryForeground} />
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                {t("report_submit").toUpperCase()}
              </Text>
            </Pressable>
          </>
        )}

        {/* ── error ────────────────────────────────────────── */}
        {!!error && (
          <View style={[styles.errorRow, { flexDirection: row }]}>
            <Feather name="alert-circle" size={14} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        {/* ── navigation buttons ────────────────────────────── */}
        <View style={[styles.navRow, { flexDirection: row }]}>
          {step > 1 && (
            <Pressable
              style={[styles.navBtn, { borderColor: colors.border, flex: 1 }]}
              onPress={prevStep}
            >
              <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={16} color={colors.text} />
              <Text style={[styles.navBtnText, { color: colors.text }]}>{t("report_back")}</Text>
            </Pressable>
          )}

          {step < 4 && (
            <Pressable
              style={[styles.navBtn, { backgroundColor: colors.primary, borderColor: colors.primary, flex: 2 }]}
              onPress={nextStep}
            >
              <Text style={[styles.navBtnText, { color: colors.primaryForeground }]}>{t("report_next")}</Text>
              <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={16} color={colors.primaryForeground} />
            </Pressable>
          )}

          {step === 3 && (
            <Pressable
              style={[styles.navSkip, { borderColor: colors.border }]}
              onPress={() => setStep(4)}
            >
              <Text style={[styles.navSkipText, { color: colors.mutedForeground }]}>{t("report_skip")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  submittingText: { fontSize: 15 },
  progressHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
    alignItems: "center",
  },
  stepTitle: { fontSize: 16, fontWeight: "700" as const, letterSpacing: 0.2 },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 8, borderRadius: 4, backgroundColor: "#E5E7EB" },
  label: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.8 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: "46%",
  },
  catLabel: { fontSize: 12, fontWeight: "600" as const },
  textAreaWrap: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
  textArea: { fontSize: 14, minHeight: 90, lineHeight: 21 },
  charCount: { fontSize: 11, alignSelf: "flex-end" },
  inputWrap: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 0,
  },
  iconLTR: { marginRight: 8 },
  iconRTL: { marginLeft: 8 },
  input: { flex: 1, fontSize: 15, height: 48 },
  sourceToggle: { gap: 8 },
  sourceBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  sourceBtnText: { fontSize: 13, fontWeight: "600" as const },
  gpsFetching: { alignItems: "center", gap: 10, paddingVertical: 4 },
  gpsText: { fontSize: 13 },
  gpsOk: { alignItems: "center" },
  gpsOkText: { fontSize: 14, fontWeight: "600" as const },
  gpsCoords: { fontSize: 12, marginTop: 2 },
  gpsDenied: { gap: 10, alignItems: "flex-start" },
  gpsDeniedText: { fontSize: 13, lineHeight: 20 },
  searchRow: { gap: 8, alignItems: "center" },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  resultsList: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  resultItem: { paddingHorizontal: 14, paddingVertical: 12, alignItems: "flex-start", gap: 0 },
  resultLabel: { fontSize: 14, fontWeight: "600" as const },
  resultAddress: { fontSize: 12, marginTop: 2 },
  selectedGeo: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  selectedGeoText: { fontSize: 14, fontWeight: "600" as const },
  selectedGeoCoords: { fontSize: 11, marginTop: 2 },
  photoHint: { fontSize: 13, lineHeight: 19 },
  thumbRow: { gap: 10, flexWrap: "wrap" },
  thumbWrap: { position: "relative" },
  thumb: { width: 100, height: 80, borderRadius: 10 },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoButtons: { gap: 10 },
  photoBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoBtnText: { fontSize: 13, fontWeight: "600" as const },
  offlineBanner: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    alignItems: "flex-start",
  },
  offlineBannerText: { fontSize: 13, fontWeight: "600" as const, lineHeight: 19 },
  emergencyNote: { fontSize: 12, color: "#DC2626", marginTop: 6, fontWeight: "600" as const },
  summaryTitle: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 14 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 0,
  },
  summaryKey: { fontSize: 12, width: 80, flexShrink: 0 },
  summaryVal: { flex: 1, fontSize: 13, fontWeight: "500" as const },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#2D7A3A",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  submitText: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 1 },
  errorRow: { alignItems: "center", gap: 6 },
  errorText: { fontSize: 13, flex: 1 },
  navRow: { gap: 10, marginTop: 4 },
  navBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navBtnText: { fontSize: 14, fontWeight: "700" as const },
  navSkip: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  navSkipText: { fontSize: 13 },
  confirmedContainer: {
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 20,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.3 },
  confirmBody: { fontSize: 14, lineHeight: 21 },
  confirmRow: { justifyContent: "space-between", alignItems: "center" },
  confirmLabel: { fontSize: 12, fontWeight: "600" as const },
  confirmValue: { fontSize: 14, fontWeight: "700" as const },
  trackBtn: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  trackBtnText: { fontSize: 15, fontWeight: "700" as const },
  anotherBtn: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  anotherBtnText: { fontSize: 14, fontWeight: "600" as const },
});
