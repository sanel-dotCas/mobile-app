import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useJobs } from "@/context/JobsContext";
import { useColors } from "@/hooks/useColors";

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, markNotificationRead, markAllRead } = useJobs();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const iconMap = {
    info: "info" as const,
    warning: "alert-triangle" as const,
    success: "check-circle" as const,
  };

  const colorMap = {
    info: colors.info,
    warning: colors.warning,
    success: colors.success,
  };

  const bgMap = {
    info: colors.info + "15",
    warning: "#fff7ed",
    success: "#dcfce7",
  };

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Notifications"
        showBack
        showNotifications={false}
        rightElement={
          unreadCount > 0 ? (
            <Pressable
              onPress={() => { markAllRead(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.markAllBtn, { borderColor: colors.primary + "50" }]}
            >
              <Feather name="check-circle" size={12} color={colors.primary} />
              <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {unreadCount > 0 && (
          <View style={[styles.unreadHeader, { backgroundColor: colors.accent }]}>
            <View style={[styles.unreadDotLarge, { backgroundColor: colors.primary }]} />
            <Text style={[styles.unreadHeaderText, { color: colors.primary }]}>
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {state.notifications.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell-off" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No notifications</Text>
          </View>
        ) : (
          state.notifications.map((notif) => (
            <Pressable
              key={notif.id}
              onPress={() => {
                markNotificationRead(notif.id);
                Haptics.selectionAsync();
              }}
              style={[
                styles.notifCard,
                {
                  backgroundColor: notif.read ? colors.card : bgMap[notif.type],
                  borderColor: notif.read ? colors.border : colorMap[notif.type] + "50",
                  shadowColor: "#000",
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: colorMap[notif.type] + "25" }]}>
                <Feather name={iconMap[notif.type]} size={18} color={colorMap[notif.type]} />
              </View>
              <View style={styles.notifBody}>
                <View style={styles.notifHeader}>
                  <Text style={[styles.notifTitle, { color: colors.foreground }]}>{notif.title}</Text>
                  {!notif.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={[styles.notifMessage, { color: colors.mutedForeground }]}>{notif.message}</Text>
                <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>
                  {new Date(notif.timestamp).toLocaleString()}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 8 },

  markAllBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  markAllText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  unreadHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: 4 },
  unreadDotLarge: { width: 8, height: 8, borderRadius: 4 },
  unreadHeaderText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  empty: { paddingVertical: 60, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular" },

  notifCard: {
    borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, borderWidth: 1.5,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notifBody: { flex: 1, gap: 3 },
  notifHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifMessage: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
