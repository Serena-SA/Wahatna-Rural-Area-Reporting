import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/context/LanguageContext";

export default function MyReportsScreen() {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {t("my_reports_loading")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  label: { fontSize: 14 },
});
