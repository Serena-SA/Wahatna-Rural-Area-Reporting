import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";
import { Pressable } from "react-native";

export default function SupervisorReportsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user } = useAuth();

  const isSupervisor = user?.role === "supervisor" || user?.role === "admin";

  if (!isSupervisor) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={[styles.heading, { color: colors.text }]}>
            {t("sup_access_restricted")}
          </Text>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
              {t("sup_go_home")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heading: { fontSize: 20, fontWeight: "700" as const, textAlign: "center" },
  label: { fontSize: 14 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  btnText: { fontWeight: "600" as const, fontSize: 14 },
});
