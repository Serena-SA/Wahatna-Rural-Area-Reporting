import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Link, router } from "expo-router";
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
import { LANGUAGE_OPTIONS, type Language } from "@/constants/i18n";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { t, language, setLanguage, isRTL } = useTranslation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t("auth_enter_credentials"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await login(username.trim(), password.trim());
      router.replace("/(tabs)");
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t("auth_invalid_credentials"));
    } finally {
      setLoading(false);
    }
  };

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
          {/* Logo / header */}
          <View style={styles.header}>
            <View
              style={[
                styles.logoRing,
                { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
              ]}
            >
              <Feather name="shield" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.brand, { color: colors.text }]}>{t("auth_sign_in_title")}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {t("auth_sign_in_subtitle")}
            </Text>
          </View>

          {/* Form card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Username */}
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.surface2, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <Feather
                name="user"
                size={18}
                color={colors.mutedForeground}
                style={isRTL ? styles.iconRTL : styles.iconLTR}
              />
              <TextInput
                style={[styles.input, { color: colors.text, textAlign: isRTL ? "right" : "left" }]}
                placeholder={t("auth_username")}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
                testID="login-username"
              />
            </View>

            {/* Password */}
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.surface2, borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <Feather
                name="lock"
                size={18}
                color={colors.mutedForeground}
                style={isRTL ? styles.iconRTL : styles.iconLTR}
              />
              <TextInput
                style={[styles.input, { color: colors.text, textAlign: isRTL ? "right" : "left" }]}
                placeholder={t("auth_password")}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPwd}
                value={password}
                onChangeText={setPassword}
                testID="login-password"
              />
              <Pressable onPress={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
                <Feather name={showPwd ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Error */}
            {!!error && (
              <View style={[styles.errorRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <Feather name="alert-circle" size={13} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            {/* Sign in button */}
            <Pressable
              style={({ pressed }) => [
                styles.loginBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleLogin}
              disabled={loading}
              testID="login-submit"
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>
                  {t("auth_sign_in").toUpperCase()}
                </Text>
              )}
            </Pressable>

            {/* Register link */}
            <Link href="/register" asChild>
              <Pressable style={styles.registerLink}>
                <Text style={[styles.registerText, { color: colors.mutedForeground }]}>
                  {t("auth_no_account")}{" "}
                  <Text style={{ color: colors.primary, fontWeight: "600" as const }}>
                    {t("auth_register")}
                  </Text>
                </Text>
              </Pressable>
            </Link>
          </View>

          {/* Demo hint */}
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t("auth_demo_hint")}
          </Text>

          {/* Language selector */}
          <View style={styles.langRow}>
            {LANGUAGE_OPTIONS.map(opt => (
              <Pressable
                key={opt.code}
                onPress={() => setLanguage(opt.code as Language)}
                style={[
                  styles.langChip,
                  {
                    backgroundColor: language === opt.code ? colors.primary : colors.surface2,
                    borderColor: language === opt.code ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.langChipText,
                    { color: language === opt.code ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {opt.nativeLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center", gap: 24, paddingVertical: 32 },
  header: { alignItems: "center", gap: 10 },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  brand: { fontSize: 28, fontWeight: "800" as const, letterSpacing: 4 },
  sub: { fontSize: 13, letterSpacing: 0.5, textAlign: "center" },
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
  eyeBtn: { padding: 4 },
  errorRow: { alignItems: "center", gap: 6 },
  errorText: { fontSize: 13 },
  loginBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2D7A3A",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  loginBtnText: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 1.5 },
  registerLink: { alignItems: "center", paddingVertical: 4 },
  registerText: { fontSize: 14 },
  hint: { textAlign: "center", fontSize: 12, letterSpacing: 0.3 },
  langRow: { flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 44,
    alignItems: "center",
  },
  langChipText: { fontSize: 13, fontWeight: "600" as const },
});
