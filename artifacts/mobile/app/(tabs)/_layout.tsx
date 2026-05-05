import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

function useNotificationUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { isAuthenticated, role } = useAuth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated || (role !== "technician")) return;
    try {
      const res = await fetch(`${BASE}/jobs/notifications`);
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent — non-critical
    }
  }, [isAuthenticated, role]);

  useEffect(() => {
    fetchCount();
    timerRef.current = setInterval(fetchCount, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchCount();
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, [fetchCount]);

  return { unreadCount, refresh: fetchCount };
}

export default function TabLayout() {
  const { isAuthenticated, isLoading, role } = useAuth();
  const colors = useColors();
  const { t } = useLang();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const router = useRouter();
  const { unreadCount } = useNotificationUnreadCount();

  useEffect(() => {
    if (!isLoading && isAuthenticated && role === "supervisor") {
      router.replace("/(supervisor)");
    }
    if (!isLoading && isAuthenticated && role === "estimator") {
      router.replace("/(estimator)");
    }
    if (!isLoading && isAuthenticated && role === "parts") {
      router.replace("/(parts)");
    }
    if (!isLoading && isAuthenticated && role === "admin") {
      router.replace("/(admin)");
    }
  }, [isLoading, isAuthenticated, role]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (role === "supervisor" || role === "estimator" || role === "parts" || role === "admin") return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : isIOS ? undefined : 64,
          paddingBottom: isIOS ? undefined : 8,
          paddingTop: isIOS ? undefined : 6,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.dashboard,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="house" tintColor={color} size={24} /> : <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t.jobs,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="briefcase" tintColor={color} size={24} /> : <Feather name="briefcase" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="timerecord"
        options={{
          title: t.timeRecord,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="clock" tintColor={color} size={24} /> : <Feather name="clock" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="yard"
        options={{
          title: "Yard",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="car.2" tintColor={color} size={24} /> : <Feather name="map" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bell" tintColor={color} size={24} />
            ) : (
              <Feather name="bell" size={22} color={color} />
            ),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#dc2626",
            color: "#fff",
            fontSize: 10,
            fontFamily: "Inter_700Bold",
            minWidth: 16,
            height: 16,
            lineHeight: 16,
            paddingHorizontal: 3,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile,
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="person.circle" tintColor={color} size={24} /> : <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
