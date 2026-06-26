import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const gradient: [string, string, string] =
    scheme === "light"
      ? ["#FBF5E6", "#F4EAD3", "#EADCBE"]
      : ["#14100A", "#1C1610", "#2E2215"];
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Enter username and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await login(username.trim(), password.trim());
      router.replace("/(tabs)");
    } catch (e: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={gradient}
      style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoRing}>
            <Feather name="shield" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.brand, { color: colors.text }]}>WAHATNA</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>UAE Municipal Field System</Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Feather name="user" size={18} color={colors.mutedForeground} style={styles.icon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Username"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              testID="login-username"
            />
          </View>

          <View style={[styles.inputWrap, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Feather name="lock" size={18} color={colors.mutedForeground} style={styles.icon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Password"
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

          {!!error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={13} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.loginBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
            testID="login-submit"
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>SIGN IN</Text>
            )}
          </Pressable>

          <Link href="/register" asChild>
            <Pressable style={styles.registerLink}>
              <Text style={[styles.registerText, { color: colors.mutedForeground }]}>
                No account?{" "}
                <Text style={{ color: colors.primary }}>Register</Text>
              </Text>
            </Pressable>
          </Link>
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Demo: demo / wahatna2024
        </Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: "center", gap: 32 },
  header: { alignItems: "center", gap: 10 },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#6DB33F",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(109,179,63,0.12)",
    shadowColor: "#C98A1A",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
  },
  brand: { fontSize: 30, fontWeight: "800" as const, letterSpacing: 5 },
  sub: { fontSize: 12, letterSpacing: 1.8, lineHeight: 18 },
  form: { gap: 16 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 54,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, height: 54 },
  eyeBtn: { padding: 4 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { fontSize: 13 },
  loginBtn: {
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "rgba(109,179,63,0.5)",
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  loginBtnText: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 2 },
  registerLink: { alignItems: "center", paddingVertical: 8 },
  registerText: { fontSize: 14 },
  hint: { textAlign: "center", fontSize: 12, letterSpacing: 0.3 },
});
