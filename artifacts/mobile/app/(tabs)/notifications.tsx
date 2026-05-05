import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

interface ServerNotification {
  id: number;
  yardUserId: string;
  title: string;
  body: string;
  jobId: string | null;
  inspectionId: number | null;
  read: boolean;
  sentAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function notifIconName(title: string): "briefcase" | "clipboard" | "bell" | "alert-triangle" | "check-circle" {
  const t = title.toLowerCase();
  if (t.includes("job")) return "briefcase";
  if (t.includes("inspection") || t.includes("insp")) return "clipboard";
  if (t.includes("fail") || t.includes("⚠")) return "alert-triangle";
  if (t.includes("reassign") || t.includes("removed")) return "alert-triangle";
  return "bell";
}

function notifColor(title: string, colors: ReturnType<typeof useColors>): string {
  const t = title.toLowerCase();
  if (t.includes("fail") || t.includes("⚠") || t.includes("removed") || t.includes("reassign")) return "#dc2626";
  if (t.includes("new") || t.includes("assigned")) return colors.primary;
  return "#7c3aed";
}

export default function NotificationsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/jobs/notifications`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // keep existing list on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await fetch(`${BASE}/jobs/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      // revert optimistic update on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n))
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch(`${BASE}/jobs/notifications/read-all`, { method: "POST" });
    } catch {
      // revert on failure — refetch
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const isIOS = Platform.OS === "ios";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        showBack={false}
        showNotifications={false}
        rightElement={
          unreadCount > 0 ? (
            <Pressable
              onPress={() => {
                markAllRead();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[styles.markAllBtn, { borderColor: colors.primary + "50" }]}
            >
              <Feather name="check-circle" size={12} color={colors.primary} />
              <Text style={[styles.markAllText, { color: colors.primary }]}>
                Mark all read
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {unreadCount > 0 && (
            <View style={[styles.unreadBanner, { backgroundColor: colors.primary + "12" }]}>
              <View style={[styles.unreadDotLarge, { backgroundColor: colors.primary }]} />
              <Text style={[styles.unreadBannerText, { color: colors.primary }]}>
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </Text>
            </View>
          )}

          {notifications.length === 0 ? (
            <View style={styles.empty}>
              {isIOS ? (
                <SymbolView name="bell.slash" tintColor={colors.mutedForeground} size={48} />
              ) : (
                <Feather name="bell-off" size={48} color={colors.mutedForeground} />
              )}
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No notifications yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Push alerts you receive will appear here so you can review them any time.
              </Text>
            </View>
          ) : (
            notifications.map((notif) => {
              const iconName = notifIconName(notif.title);
              const iconColor = notifColor(notif.title, colors);
              return (
                <Pressable
                  key={notif.id}
                  onPress={() => {
                    if (!notif.read) {
                      markRead(notif.id);
                      Haptics.selectionAsync();
                    }
                  }}
                  style={[
                    styles.card,
                    {
                      backgroundColor: notif.read ? colors.card : iconColor + "0d",
                      borderColor: notif.read ? colors.border : iconColor + "40",
                    },
                  ]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: iconColor + "20" }]}>
                    <Feather name={iconName} size={18} color={iconColor} />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {notif.title}
                      </Text>
                      {!notif.read && (
                        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                    <Text style={[styles.cardBody2, { color: colors.mutedForeground }]}>
                      {notif.body}
                    </Text>
                    <View style={styles.cardFooter}>
                      <Feather name="clock" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>
                        {timeAgo(notif.sentAt)}
                      </Text>
                      {(notif.jobId || notif.inspectionId) && (
                        <>
                          <View style={[styles.footerDot, { backgroundColor: colors.mutedForeground }]} />
                          <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>
                            {notif.jobId ? `Job ${notif.jobId}` : `Inspection #${notif.inspectionId}`}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 8 },

  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  markAllText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  unreadBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  unreadDotLarge: { width: 8, height: 8, borderRadius: 4 },
  unreadBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  empty: { paddingVertical: 60, alignItems: "center", gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },

  card: {
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardBody2: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  footerDot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 2 },
});
