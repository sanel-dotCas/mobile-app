import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import type { EstimateStatus } from "@/context/EstimatesContext";
import { useEstimates } from "@/context/EstimatesContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const STATUS_LABELS: Record<EstimateStatus, string> = {
  pending_inspection:       "Pending Inspection",
  inspection_in_progress:   "In Progress",
  review:                   "Under Review",
  approved:                 "Approved",
  submitted:                "Submitted to DMS",
};

export default function EstimatorNotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useEstimates();
  const { t } = useLang();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const notifs = state.estimates.map((e) => ({
    id: e.id,
    estimateNo: e.estimateNo,
    vehicle: e.vehicle,
    status: e.status,
    createdAt: e.createdAt,
  }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title={t.notifications} subtitle={t.estimator} showNotifications={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {notifs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell-off" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t.noNotifications}</Text>
          </View>
        ) : (
          notifs.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => Haptics.selectionAsync()}
              style={({ pressed }) => [
                styles.notifCard,
                { backgroundColor: colors.card, borderColor: n.status === "pending_inspection" ? "#bfdbfe" : colors.border, opacity: pressed ? 0.9 : 1, shadowColor: "#000" },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: n.status === "pending_inspection" ? "#dbeafe" : colors.secondary }]}>
                <Feather name="file-text" size={18} color={n.status === "pending_inspection" ? "#2563eb" : colors.mutedForeground} />
              </View>
              <View style={styles.body}>
                <View style={styles.row}>
                  <Text style={[styles.title, { color: colors.foreground }]}>{n.estimateNo}</Text>
                  {n.status === "pending_inspection" && (
                    <View style={styles.newDot}>
                      <View style={[styles.dot, { backgroundColor: "#2563eb" }]} />
                    </View>
                  )}
                </View>
                <Text style={[styles.vehicle, { color: colors.foreground }]}>{n.vehicle}</Text>
                <Text style={[styles.statusLabel, { color: n.status === "pending_inspection" ? "#2563eb" : colors.mutedForeground }]}>
                  {STATUS_LABELS[n.status]}
                </Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>
                  {new Date(n.createdAt).toLocaleString()}
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
  screen:     { flex: 1 },
  scroll:     { flex: 1 },
  content:    { padding: 16, gap: 10 },
  empty:      { paddingVertical: 60, alignItems: "center", gap: 10 },
  emptyText:  { fontSize: 16, fontFamily: "Inter_400Regular" },
  notifCard:  { borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, borderWidth: 1.5, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  iconWrap:   { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  body:       { flex: 1, gap: 3 },
  row:        { flexDirection: "row", alignItems: "center", gap: 8 },
  title:      { fontSize: 13, fontFamily: "Inter_700Bold", flex: 1 },
  newDot:     { width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  vehicle:    { fontSize: 13, fontFamily: "Inter_500Medium" },
  statusLabel:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },
  time:       { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
});
