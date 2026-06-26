import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { fetch as expoFetch } from "expo/fetch";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useOfflineQueue } from "@/context/OfflineQueueContext";
import { useNetworkState } from "@/hooks/useNetworkState";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = [
  { key: "heat_stress", label: "Heat Stress", icon: "thermometer" as const, color: "#C65A3A" },
  { key: "road_damage", label: "Road Damage", icon: "navigation" as const, color: "#C77A2A" },
  { key: "waste", label: "Waste", icon: "trash-2" as const, color: "#9B7BC4" },
  { key: "flood", label: "Flood", icon: "droplet" as const, color: "#5E9AA0" },
  { key: "fire", label: "Fire", icon: "alert-triangle" as const, color: "#A8442B" },
  { key: "electrical", label: "Electrical", icon: "zap" as const, color: "#C98A1A" },
  { key: "structural", label: "Structural", icon: "home" as const, color: "#A3916C" },
  { key: "other", label: "Other", icon: "more-horizontal" as const, color: "#8A7A5C" },
];

type SubmitPhase = "form" | "analyzing" | "result";

interface ReportResult {
  incident_id: number;
  report_id: number;
  score_awarded: number;
  worker_total_score?: number;
  created_at?: string;
  vision?: {
    threat_class?: string;
    threat_label?: string;
    confidence?: number;
    severity?: number;
  };
  assessment?: {
    risk_level?: string;
    risk_score?: number;
    assessment_summary?: string;
    recommended_protocol?: string;
    regulatory_reference?: string;
    dialect_note?: string;
    context_sources?: string[];
  };
}

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { lastLocation } = useLocation();
  const { addToQueue } = useOfflineQueue();
  const { isOnline } = useNetworkState();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [category, setCategory] = useState("heat_stress");
  const [reportText, setReportText] = useState("");
  const [phase, setPhase] = useState<SubmitPhase>("form");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState("");
  const [pulseAnim] = useState(new Animated.Value(1));
  const [scoreAnim] = useState(new Animated.Value(0));

  const lat = lastLocation?.lat ?? 25.2048;
  const lon = lastLocation?.lon ?? 55.2708;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!res.canceled && res.assets[0]) setImageUri(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!res.canceled && res.assets[0]) setImageUri(res.assets[0].uri);
  };

  const pulseButton = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const animateScore = () => {
    Animated.timing(scoreAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  };

  const submit = async () => {
    if (!reportText.trim()) { setError("Describe the hazard"); return; }
    setError("");
    pulseButton();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (!isOnline) {
      await addToQueue({ lat, lon, reportText: reportText.trim(), category, imageUri: imageUri ?? undefined });
      setPhase("result");
      setResult(null);
      animateScore();
      return;
    }

    setPhase("analyzing");
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const base = domain ? `https://${domain}/api` : "http://localhost:8080/api";

    try {
      const formData = new FormData();
      formData.append("lat", String(lat));
      formData.append("lon", String(lon));
      formData.append("report_text", reportText.trim());
      formData.append("category", category);
      if (imageUri) {
        const ext = (imageUri.split(".").pop()?.split("?")[0] ?? "jpg").toLowerCase();
        const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? ext : "jpg";
        if (Platform.OS === "web") {
          try {
            const blobRes = await fetch(imageUri);
            const blob = await blobRes.blob();
            formData.append("image", blob, `hazard.${safeExt}`);
          } catch {
            // skip image if blob fetch fails
          }
        } else {
          formData.append("image", { uri: imageUri, name: `hazard.${safeExt}`, type: `image/${safeExt}` } as unknown as Blob);
        }
      }

      const res = await expoFetch(`${base}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as ReportResult;
      setResult(data);
      setPhase("result");
      animateScore();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError((e as Error).message);
      setPhase("form");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const reset = () => {
    setPhase("form");
    setResult(null);
    setImageUri(null);
    setReportText("");
    scoreAnim.setValue(0);
  };

  const paddingBottom = insets.bottom + 90;

  if (phase === "analyzing") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={styles.analyzingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.analyzingTitle, { color: colors.text }]}>Analyzing Hazard</Text>
          <Text style={[styles.analyzingSubtitle, { color: colors.mutedForeground }]}>Running vision + AI assessment…</Text>
        </View>
      </View>
    );
  }

  if (phase === "result") {
    const offline = !isOnline;
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Animated.View style={{ opacity: scoreAnim, alignItems: "center", gap: 16, width: "100%" }}>
          {offline ? (
            <>
              <View style={[styles.successIcon, { backgroundColor: colors.glowAmber }]}>
                <Feather name="clock" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.resultTitle, { color: colors.text }]}>Queued Offline</Text>
              <Text style={[styles.resultSub, { color: colors.mutedForeground }]}>Will sync when back online</Text>
            </>
          ) : result ? (
            <>
              <View style={[styles.successIcon, { backgroundColor: colors.glowGreen }]}>
                <Feather name="check-circle" size={40} color={colors.success} />
              </View>
              <Text style={[styles.resultTitle, { color: colors.text }]}>Report Submitted</Text>
              <GlassCard style={{ width: "100%" }} glowColor={colors.glowAmber} padding={20}>
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>SCORE EARNED</Text>
                  <Text style={[styles.scoreValue, { color: colors.primary }]}>+{result.score_awarded}</Text>
                </View>
                <View style={styles.resultDetails}>
                  <SeverityBadge level={result.assessment?.risk_level ?? "amber"} size="lg" />
                  <Text style={[styles.threatClass, { color: colors.text }]}>
                    {result.vision?.threat_label ?? result.vision?.threat_class ?? "Hazard"}
                  </Text>
                  {result.vision?.confidence != null && (
                    <Text style={[styles.confidence, { color: colors.mutedForeground }]}>
                      {(result.vision.confidence * 100).toFixed(0)}% confidence
                    </Text>
                  )}
                </View>
                {!!result.assessment?.assessment_summary && (
                  <View style={[styles.recommendations, { borderTopColor: colors.border }]}>
                    <Text style={[styles.recTitle, { color: colors.mutedForeground }]}>ASSESSMENT</Text>
                    <Text style={[styles.recText, { color: colors.text }]}>
                      {result.assessment.assessment_summary}
                    </Text>
                  </View>
                )}
                {!!result.assessment?.recommended_protocol && (
                  <View style={[styles.recommendations, { borderTopColor: colors.border }]}>
                    <Text style={[styles.recTitle, { color: colors.mutedForeground }]}>RECOMMENDED PROTOCOL</Text>
                    <View style={styles.recRow}>
                      <Feather name="chevron-right" size={12} color={colors.primary} />
                      <Text style={[styles.recText, { color: colors.text }]}>
                        {result.assessment.recommended_protocol}
                      </Text>
                    </View>
                  </View>
                )}
              </GlassCard>
            </>
          ) : null}
          <Pressable
            style={[styles.newReportBtn, { borderColor: colors.primary }]}
            onPress={reset}
          >
            <Text style={[styles.newReportText, { color: colors.primary }]}>New Report</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom, gap: 16 }} keyboardShouldPersistTaps="handled">
        {!isOnline && (
          <View style={[styles.offlineNote, { backgroundColor: colors.glowAmber, borderColor: colors.warning }]}>
            <Feather name="wifi-off" size={13} color={colors.warning} />
            <Text style={[styles.offlineNoteText, { color: colors.warning }]}>Offline — report will be queued</Text>
          </View>
        )}

        <View style={styles.cameraSection}>
          {imageUri ? (
            <Pressable onPress={pickImage}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <View style={styles.changeOverlay}>
                <Feather name="camera" size={20} color="#fff" />
              </View>
            </Pressable>
          ) : (
            <View style={styles.cameraButtons}>
              <Pressable
                style={({ pressed }) => [styles.shutterBtn, { borderColor: colors.primary, backgroundColor: pressed ? colors.glowAmber : "transparent" }]}
                onPress={takePhoto}
              >
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Feather name="camera" size={28} color={colors.primary} />
                </Animated.View>
                <Text style={[styles.shutterLabel, { color: colors.text }]}>Camera</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.galleryBtn, { borderColor: colors.border, backgroundColor: pressed ? colors.surface2 : "transparent" }]}
                onPress={pickImage}
              >
                <Feather name="image" size={20} color={colors.mutedForeground} />
                <Text style={[styles.galleryLabel, { color: colors.mutedForeground }]}>Gallery</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>HAZARD CATEGORY</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.key}
              onPress={() => { setCategory(cat.key); Haptics.selectionAsync(); }}
              style={[
                styles.categoryBtn,
                {
                  backgroundColor: category === cat.key ? `${cat.color}22` : colors.surface2,
                  borderColor: category === cat.key ? cat.color : colors.border,
                },
              ]}
            >
              <Feather name={cat.icon} size={18} color={category === cat.key ? cat.color : colors.mutedForeground} />
              <Text style={[styles.categoryLabel, { color: category === cat.key ? cat.color : colors.mutedForeground }]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.gpsRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <Feather name="map-pin" size={14} color={colors.primary} />
          <Text style={[styles.gpsText, { color: colors.mutedForeground }]}>
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </Text>
          {lastLocation && <Feather name="check-circle" size={12} color={colors.success} />}
        </View>

        <View style={[styles.textAreaWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textArea, { color: colors.text }]}
            placeholder="Describe the hazard in detail…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            value={reportText}
            onChangeText={setReportText}
            textAlignVertical="top"
          />
        </View>

        {!!error && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={13} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            style={[styles.submitBtn, { backgroundColor: colors.danger, shadowColor: colors.glowRed }]}
            onPress={submit}
          >
            <Feather name="alert-triangle" size={18} color="#fff" />
            <Text style={styles.submitText}>REPORT HAZARD</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.5 },
  cameraSection: { alignItems: "center" },
  cameraButtons: { flexDirection: "row", gap: 12, justifyContent: "center" },
  shutterBtn: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 2,
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  shutterLabel: { fontSize: 12, fontWeight: "600" as const },
  galleryBtn: {
    width: 80, height: 80, borderRadius: 16, borderWidth: 1,
    alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "center",
  },
  galleryLabel: { fontSize: 11 },
  preview: { width: 200, height: 150, borderRadius: 16 },
  changeOverlay: {
    position: "absolute", bottom: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 16, padding: 6,
  },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1,
    minWidth: "45%",
  },
  categoryLabel: { fontSize: 12, fontWeight: "600" as const },
  gpsRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
  },
  gpsText: { flex: 1, fontSize: 12 },
  textAreaWrap: { borderRadius: 16, borderWidth: 1, padding: 14 },
  textArea: { fontSize: 14, minHeight: 90, lineHeight: 21 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { fontSize: 13 },
  submitBtn: {
    height: 56, borderRadius: 18, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10,
    shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" as const, letterSpacing: 1.5 },
  analyzingContainer: { alignItems: "center", gap: 16 },
  analyzingTitle: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3 },
  analyzingSubtitle: { fontSize: 14, lineHeight: 21 },
  successIcon: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  resultTitle: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.3 },
  resultSub: { fontSize: 14, lineHeight: 21 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  scoreLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1 },
  scoreValue: { fontSize: 32, fontWeight: "800" as const },
  resultDetails: { gap: 8, marginBottom: 16 },
  threatClass: { fontSize: 16, fontWeight: "600" as const },
  confidence: { fontSize: 12 },
  recommendations: { borderTopWidth: 1, paddingTop: 12, gap: 6 },
  recTitle: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 4 },
  recRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  recText: { fontSize: 12, flex: 1, lineHeight: 18 },
  newReportBtn: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14 },
  newReportText: { fontSize: 15, fontWeight: "700" as const },
  offlineNote: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderRadius: 12, borderWidth: 1 },
  offlineNoteText: { fontSize: 12, fontWeight: "600" as const },
});
