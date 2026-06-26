import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const ROLES = [
  { key: "worker", label: "Field Worker" },
  { key: "supervisor", label: "Supervisor" },
];

export default function RegisterScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const gradient: [string, string, string] =
    scheme === "light"
      ? ["#FBF5E6", "#F4EAD3", "#EADCBE"]
      : ["#14100A", "#1C1610", "#2E2215"];
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("worker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password.trim(), role);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError((e as Error).message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={gradient} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>

          <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Join the Wahatna field network</Text>

          <View style={styles.form}>
            {[
              { label: "Username", value: username, setter: setUsername, icon: "user" as const, autoCapitalize: "none" as const },
              { label: "Email", value: email, setter: setEmail, icon: "mail" as const, autoCapitalize: "none" as const },
              { label: "Password", value: password, setter: setPassword, icon: "lock" as const, secureTextEntry: true, autoCapitalize: "none" as const },
            ].map(field => (
              <View key={field.label} style={[styles.inputWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <Feather name={field.icon} size={18} color={colors.mutedForeground} style={styles.icon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder={field.label}
                  placeholderTextColor={colors.mutedForeground}
                  value={field.value}
                  onChangeText={field.setter}
                  secureTextEntry={field.secureTextEntry}
                  autoCapitalize={field.autoCapitalize ?? "none"}
                  autoCorrect={false}
                />
              </View>
            ))}

            <Text style={[styles.roleLabel, { color: colors.mutedForeground }]}>ROLE</Text>
            <View style={styles.roleRow}>
              {ROLES.map(r => (
                <Pressable
                  key={r.key}
                  onPress={() => setRole(r.key)}
                  style={[
                    styles.roleBtn,
                    {
                      backgroundColor: role === r.key ? colors.primary : colors.surface2,
                      borderColor: role === r.key ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: role === r.key ? colors.primaryForeground : colors.mutedForeground, fontWeight: "600" as const }}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {!!error && (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={13} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryForeground }]}>CREATE ACCOUNT</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 28, gap: 8 },
  backBtn: { marginBottom: 24, width: 40 },
  title: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.3 },
  sub: { fontSize: 13, marginBottom: 24, lineHeight: 19 },
  form: { gap: 14 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, height: 54 },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, height: 54 },
  roleLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1, marginTop: 4 },
  roleRow: { flexDirection: "row", gap: 10 },
  roleBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { fontSize: 13 },
  submitBtn: {
    height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 8,
    shadowColor: "rgba(109,179,63,0.5)", shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  submitText: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 2 },
});
