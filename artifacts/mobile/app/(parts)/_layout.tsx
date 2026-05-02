import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function PartsLayout() {
  const { isAuthenticated, isLoading, role } = useAuth();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (role !== "parts") return <Redirect href="/(tabs)" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#7c3aed",
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
          title: "Dashboard",
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color }) => <Feather name="package" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => <Feather name="inbox" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="count"
        options={{
          title: "Count",
          tabBarIcon: ({ color }) => <Feather name="clipboard" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="suggestions"
        options={{
          title: "Suggest",
          tabBarIcon: ({ color }) => <Feather name="zap" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
