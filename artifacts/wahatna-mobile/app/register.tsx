import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/context/LanguageContext";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const { t, isRTL } = useTranslation();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError(t("auth_all_fields_required"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Role is always "user" — backend enforces this regardless
      await register(username.trim(), email.trim(), password.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError((e as Error).message || t("auth_registration_failed"));
    } finally {
      setLoading(false);
    }
  };

  const fields: Array<{
    key: string;
    label: string;
    value: string;
    setter: (v: string) => void;
    icon: "user" | "mail" | "lock" | "type";
    secure?: boolean;
  }> = [
    { key: "username", label: t("auth_username"), value: username, setter: setUsername, icon: "user" },
    { key: "email",    label: t("auth_email"),    value: email,    setter: setEmail,    icon: "mail" },
    { key: "password", label: t("auth_password"), value: password, setter: setPassword, icon: "lock", secure: true },
    { key: "fullName", label: t("auth_full_name_optional"), value: fullName, setter: setFullName, icon: "type" },
  ];

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { flexDirection: isRTL ? "row-reverse" : "row" }]}
          >
            <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={22} color={colors.text} />
          </Pressable>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text, textAlign: isRTL ? "right" : "left" }]}>
            {t("auth_create_account")}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {t("auth_join_subtitle")}
          </Text>

          {/* Form card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {fields.map(field => (
              <View
                key={field.key}
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: colors.surface2,
                    borderColor: colors.border,
                    flexDirection: isRTL ? "row-reverse" : "row",
                  },
                ]}
              >
                <Feather
                  name={field.icon}
                  size={18}
                  color={colors.mutedForeground}
                  style={isRTL ? styles.iconRTL : styles.iconLTR}
                />
                <TextInput
                  style={[styles.input, { color: colors.text, textAlign: isRTL ? "right" : "left" }]}
                  placeholder={field.label}
                  placeholderTextColor={colors.mutedForeground}
                  value={field.value}
                  onChangeText={field.setter}
                  secureTextEntry={field.secure}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}

            {!!error && (
              <View style={[styles.errorRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Feather name="alert-circle" size={13} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                  {t("auth_create_account").toUpperCase()}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24, gap: 12 },
  backBtn: { marginBottom: 8, width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.3 },
  sub: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inputWrap: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
  },
  iconLTR: { marginRight: 10 },
  iconRTL: { marginLeft: 10 },
  input: { flex: 1, fontSize: 15, height: 52 },
  errorRow: { alignItems: "center", gap: 6 },
  errorText: { fontSize: 13 },
  submitBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#2D7A3A",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  submitText: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 1.5 },
});
