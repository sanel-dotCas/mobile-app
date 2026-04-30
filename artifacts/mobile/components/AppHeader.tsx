import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useJobs } from "@/context/JobsContext";
import { useColors } from "@/hooks/useColors";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  rightElement?: React.ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  showNotifications = true,
  rightElement,
}: AppHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { unreadCount } = useJobs();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.headerBg, paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {showBack && (
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
          )}
          <View>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.right}>
          {rightElement}
          {showNotifications && (
            <Pressable
              onPress={() => router.push("/notifications")}
              style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
              hitSlop={8}
            >
              <Feather name="bell" size={18} color={colors.foreground} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          )}
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>MR</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});
