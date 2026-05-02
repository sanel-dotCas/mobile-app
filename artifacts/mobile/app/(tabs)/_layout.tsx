import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const { isAuthenticated, isLoading, role } = useAuth();
  const colors = useColors();
  const { t } = useLang();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const router = useRouter();

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
  }, [isLoading, isAuthenticated, role]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (role === "supervisor" || role === "estimator" || role === "parts") return null;

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
          height: isWeb ? 84 : undefined,
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
