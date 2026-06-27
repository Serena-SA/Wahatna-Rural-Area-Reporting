import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard } from "@/components/GlassCard";
import type { Translations } from "@/constants/i18n";
import { useTranslation } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

type Glyph = "info" | "map-pin" | "shield" | "thermometer" | "wifi-off" | "users";

interface Card {
  icon: Glyph;
  titleKey: keyof Translations;
  bodyKey: keyof Translations;
  tint: string;
}

// Curated awareness cards (the most engaging / Al Qua'a-focused of the set).
const CARDS: Card[] = [
  { icon: "info", titleKey: "about_what_title", bodyKey: "about_what_body", tint: "#2D7A3A" },
  { icon: "map-pin", titleKey: "about_alquaa_title", bodyKey: "about_alquaa_body", tint: "#B45309" },
  { icon: "shield", titleKey: "about_report_title", bodyKey: "about_report_body", tint: "#2563EB" },
  { icon: "thermometer", titleKey: "about_heat_title", bodyKey: "about_heat_body", tint: "#EA580C" },
  { icon: "wifi-off", titleKey: "about_offline_title", bodyKey: "about_offline_body", tint: "#6B7280" },
  { icon: "users", titleKey: "about_community_title", bodyKey: "about_community_body", tint: "#7C3AED" },
];

/** Short, icon-led awareness cards shown on the Home screen. */
export function AwarenessCards() {
  const colors = useColors();
  const { t, isRTL } = useTranslation();
  const row: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";
  const textAlign: "left" | "right" = isRTL ? "right" : "left";

  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.sectionTitle, { textAlign }]}>{t("about_section_title")}</Text>
      {CARDS.map((c) => (
        <GlassCard key={c.titleKey} padding={14}>
          <View style={[styles.cardRow, { flexDirection: row }]}>
            <View style={[styles.iconChip, { backgroundColor: c.tint + "1A" }]}>
              <Feather name={c.icon} size={18} color={c.tint} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={[styles.cardTitle, { color: colors.text, textAlign }]}>
                {t(c.titleKey)}
              </Text>
              <Text style={[styles.cardBody, { color: colors.mutedForeground, textAlign }]}>
                {t(c.bodyKey)}
              </Text>
            </View>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 2,
  },
  cardRow: { alignItems: "flex-start" },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: { fontSize: 14, fontWeight: "700" as const, marginBottom: 3 },
  cardBody: { fontSize: 12.5, lineHeight: 18 },
});
