import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LanguageContext";

export default function TabLayout() {
  const colors = useColors();
  const { user } = useAuth();
  const { t } = useTranslation();

  const isSupervisor = user?.role === "supervisor" || user?.role === "admin";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" as const, color: colors.text },
        tabBarLabelStyle: { fontWeight: "600" as const, letterSpacing: 0.2, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 72,
          paddingTop: 6,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarBackground: () =>
          isWeb
            ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
            : null,
      }}
    >
      {/* ── Home ────────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav_home"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={22} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />

      {/* ── Report — community reporter submission (users only) ─ */}
      <Tabs.Screen
        name="report"
        options={
          isSupervisor
            ? { href: null, title: "Report" }
            : {
                title: t("nav_report"),
                tabBarIcon: ({ color }) =>
                  isIOS ? (
                    <SymbolView name="exclamationmark.triangle" tintColor={color} size={22} />
                  ) : (
                    <Feather name="alert-triangle" size={22} color={color} />
                  ),
              }
        }
      />

      {/* ── Reports list — supervisor incident list (supervisors only) */}
      <Tabs.Screen
        name="reports"
        options={
          isSupervisor
            ? {
                title: t("nav_reports"),
                tabBarIcon: ({ color }) =>
                  isIOS ? (
                    <SymbolView name="list.bullet.clipboard" tintColor={color} size={22} />
                  ) : (
                    <Feather name="clipboard" size={22} color={color} />
                  ),
              }
            : { href: null, title: "Reports" }
        }
      />

      {/* ── My Reports (users only) ─────────────────────────── */}
      <Tabs.Screen
        name="my-reports"
        options={
          isSupervisor
            ? { href: null, title: "My Reports" }
            : {
                title: t("nav_my_reports"),
                tabBarIcon: ({ color }) =>
                  isIOS ? (
                    <SymbolView name="doc.text" tintColor={color} size={22} />
                  ) : (
                    <Feather name="file-text" size={22} color={color} />
                  ),
              }
        }
      />

      {/* ── Fleet (supervisors only) ────────────────────────── */}
      <Tabs.Screen
        name="fleet"
        options={
          isSupervisor
            ? {
                title: t("nav_fleet"),
                tabBarIcon: ({ color }) =>
                  isIOS ? (
                    <SymbolView name="truck.box" tintColor={color} size={22} />
                  ) : (
                    <Feather name="truck" size={22} color={color} />
                  ),
              }
            : { href: null, title: "Fleet" }
        }
      />

      {/* ── Dashboard (legacy — hidden, kept for deep-link compat) */}
      <Tabs.Screen
        name="dashboard"
        options={{ href: null, title: "Dashboard" }}
      />

      {/* ── Supervisor (supervisors only) ───────────────────── */}
      <Tabs.Screen
        name="supervisor"
        options={
          isSupervisor
            ? {
                title: t("nav_supervisor"),
                tabBarIcon: ({ color }) =>
                  isIOS ? (
                    <SymbolView name="person.badge.shield.checkmark" tintColor={color} size={22} />
                  ) : (
                    <Feather name="shield" size={22} color={color} />
                  ),
              }
            : { href: null, title: "Supervisor" }
        }
      />
    </Tabs>
  );
}
