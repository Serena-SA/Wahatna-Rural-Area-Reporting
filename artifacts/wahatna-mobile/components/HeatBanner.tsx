import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AL_QUAA, fetchAlQuaaTempC, getBanStatus, temperatureRiskLevel } from "@/constants/heat";
import { useTranslation } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const RISK_COLOR: Record<string, string> = {
  low: "#16A34A",
  moderate: "#D97706",
  elevated: "#EA580C",
  high: "#DC2626",
  critical: "#B91C1C",
};

function fmtCountdown(mins: number, hUnit: string, mUnit: string): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}${hUnit} ${m}${mUnit}` : `${m}${mUnit}`;
}

/**
 * Always-on heat-compliance banner for the Home screen: live Al Qua'a
 * temperature (Open-Meteo), MOHRE midday-ban status, the Tropic of Cancer
 * note, and coordinates.
 */
export function HeatBanner() {
  const colors = useColors();
  const { t, isRTL } = useTranslation();
  const row: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
  const textAlign: "left" | "right" = isRTL ? "right" : "left";

  const [tempC, setTempC] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(getBanStatus());

  useEffect(() => {
    let mounted = true;
    const loadTemp = async () => {
      const t2 = await fetchAlQuaaTempC();
      if (mounted) {
        setTempC(t2);
        setLoading(false);
      }
    };
    loadTemp();
    const tempTimer = setInterval(loadTemp, 10 * 60 * 1000); // refresh temp every 10 min
    const statusTimer = setInterval(() => setStatus(getBanStatus()), 30 * 1000); // tick countdown
    return () => {
      mounted = false;
      clearInterval(tempTimer);
      clearInterval(statusTimer);
    };
  }, []);

  const risk = tempC != null ? temperatureRiskLevel(tempC) : "moderate";
  const accent = status.active ? "#DC2626" : RISK_COLOR[risk] ?? "#D97706";

  let statusText: string;
  if (status.active) {
    statusText =
      t("heat_ban_active") +
      (status.minutesUntilEnd != null
        ? ` · ${t("heat_ban_ends_in")} ${fmtCountdown(status.minutesUntilEnd, t("time_h"), t("time_m"))}`
        : "");
  } else if (status.inSeason && status.minutesUntilStart != null && status.minutesUntilStart <= 180) {
    statusText = `${t("heat_ban_starts_in")} ${fmtCountdown(status.minutesUntilStart, t("time_h"), t("time_m"))}`;
  } else {
    statusText = t("heat_ban_none");
  }

  // Progressive pre-ban advisory as the midday ban nears (drink → shade → leave).
  // 2 h out → hydrate; 1 h out → seek shade; 30 min out → wrap up and leave.
  let advisory: { text: string; icon: "droplet" | "umbrella" | "clock"; color: string } | null = null;
  if (!status.active && status.inSeason && status.minutesUntilStart != null) {
    const m = status.minutesUntilStart;
    if (m <= 30) advisory = { text: t("heat_advisory_30"), icon: "clock", color: "#DC2626" };
    else if (m <= 60) advisory = { text: t("heat_advisory_60"), icon: "umbrella", color: "#EA580C" };
    else if (m <= 120) advisory = { text: t("heat_advisory_120"), icon: "droplet", color: "#D97706" };
  }

  return (
    <View style={[styles.banner, { backgroundColor: colors.card, borderColor: accent + "66" }]}>
      <View style={[styles.accentStripe, { backgroundColor: accent }]} />
      <View style={[styles.topRow, { flexDirection: row }]}>
        <View style={[styles.iconWrap, { backgroundColor: accent + "22" }]}>
          <Feather name={status.active ? "alert-triangle" : "sun"} size={20} color={accent} />
        </View>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <View style={[styles.titleRow, { flexDirection: row }]}>
            {loading ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Text style={[styles.temp, { color: accent }]}>{tempC != null ? `${tempC}°C` : "—"}</Text>
            )}
            <Text style={[styles.place, { color: colors.text, textAlign }]} numberOfLines={1}>
              · {AL_QUAA.name} · {statusText}
            </Text>
          </View>
          <Text style={[styles.tropic, { color: colors.mutedForeground, textAlign }]}>
            {t("heat_tropic")}
          </Text>
          <Text style={[styles.coords, { color: colors.mutedForeground, textAlign }]}>
            {AL_QUAA.lat.toFixed(2)}°N, {AL_QUAA.lon.toFixed(2)}°E
          </Text>
        </View>
      </View>

      {advisory && (
        <View
          style={[
            styles.advisory,
            { flexDirection: row, backgroundColor: advisory.color + "16", borderColor: advisory.color + "55" },
          ]}
        >
          <Feather name={advisory.icon} size={16} color={advisory.color} />
          <Text style={[styles.advisoryText, { color: advisory.color, textAlign }]}>
            {advisory.text}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accentStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  topRow: { alignItems: "flex-start" },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  titleRow: { alignItems: "center", gap: 6, flexWrap: "wrap" },
  temp: { fontSize: 18, fontWeight: "800" as const },
  place: { fontSize: 13, fontWeight: "600" as const, flexShrink: 1 },
  tropic: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  coords: { fontSize: 11, marginTop: 2, fontVariant: ["tabular-nums"] },
  advisory: {
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  advisoryText: { fontSize: 12.5, fontWeight: "700" as const, lineHeight: 17, flex: 1 },
});
