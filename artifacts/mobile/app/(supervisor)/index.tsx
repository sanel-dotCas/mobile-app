import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { useAuth } from "@/context/AuthContext";
import { useJobs } from "@/context/JobsContext";
import { useColors } from "@/hooks/useColors";

const STATUS_CONFIG = {
  active: { color: "#16a34a", bg: "#dcfce7", label: "Active", icon: "zap" as const },
  idle: { color: "#64748b", bg: "#f1f5f9", label: "Idle", icon: "pause-circle" as const },
  break: { color: "#d97706", bg: "#fef3c7", label: "Break", icon: "coffee" as const },
  absent: { color: "#ef4444", bg: "#fee2e2", label: "Absent", icon: "x-circle" as const },
};

export default function LiveSupervisionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useJobs();
  const { logout } = useAuth();
  const router = useRouter();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const active = state.technicians.filter((t) => t.status === "active").length;
  const idle = state.technicians.filter((t) => t.status === "idle").length;
  const onBreak = state.technicians.filter((t) => t.status === "break").length;
  const totalJobs = state.jobs.filter((j) => j.status !== "completed").length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Live Supervision"
        subtitle="Production Planner"
        rightElement={
          <Pressable onPress={logout} style={[styles.logoutBtn, { borderColor: colors.border }]}>
            <Feather name="log-out" size={14} color={colors.foreground} />
          </Pressable>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary KPIs */}
        <View style={styles.kpiRow}>
          {[
            { label: "Active", value: active, color: "#16a34a", bg: "#dcfce7", icon: "zap" as const },
            { label: "On Break", value: onBreak, color: "#d97706", bg: "#fef3c7", icon: "coffee" as const },
            { label: "Idle", value: idle, color: "#64748b", bg: "#f1f5f9", icon: "pause" as const },
            { label: "Open Jobs", value: totalJobs, color: colors.primary, bg: colors.accent, icon: "briefcase" as const },
          ].map(({ label, value, color, bg, icon }) => (
            <View key={label} style={[styles.kpiCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
              <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
                <Feather name={icon} size={15} color={color} />
              </View>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>{value}</Text>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Technician Cards */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Technicians on Floor</Text>
        {state.technicians.map((tech) => {
          const cfg = STATUS_CONFIG[tech.status];
          const currentJob = tech.currentJobId ? state.jobs.find((j) => j.id === tech.currentJobId) : null;
          return (
            <Pressable
              key={tech.id}
              onPress={() => router.push("/(supervisor)/technicians")}
              style={[styles.techCard, { backgroundColor: colors.card, borderColor: tech.status === "active" ? colors.primary : colors.border, shadowColor: "#000" }]}
            >
              {tech.status === "active" && <View style={[styles.activeLine, { backgroundColor: colors.primary }]} />}
              <View style={styles.techRow}>
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{tech.avatar}</Text>
                </View>
                <View style={styles.techInfo}>
                  <View style={styles.techNameRow}>
                    <Text style={[styles.techName, { color: colors.foreground }]}>{tech.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Feather name={cfg.icon} size={10} color={cfg.color} />
                      <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Text style={[styles.techRole, { color: colors.mutedForeground }]}>{tech.role}</Text>
                  {currentJob && (
                    <Text style={[styles.techJob, { color: colors.primary }]} numberOfLines={1}>
                      → Estimate {currentJob.estimateNumber} · {currentJob.vehicle}
                    </Text>
                  )}
                </View>
              </View>
              <View style={[styles.techStats, { borderTopColor: colors.border }]}>
                <View style={styles.techStat}>
                  <Feather name="clock" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.techStatText, { color: colors.mutedForeground }]}>{tech.totalHoursToday}h today</Text>
                </View>
                <View style={styles.techStat}>
                  <Feather name="trending-up" size={11} color={colors.success} />
                  <Text style={[styles.techStatText, { color: colors.mutedForeground }]}>{tech.efficiency}% efficiency</Text>
                </View>
                {tech.status !== "absent" && (
                  <View style={[styles.effBar, { backgroundColor: colors.secondary }]}>
                    <View style={[styles.effFill, { width: `${tech.efficiency}%` as `${number}%`, backgroundColor: tech.efficiency > 80 ? colors.success : colors.warning }]} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {[
            { label: "Assign Job", icon: "plus-circle" as const, route: "/(supervisor)/jobs" },
            { label: "View All Jobs", icon: "list" as const, route: "/(supervisor)/jobs" },
            { label: "Workshop Load", icon: "bar-chart-2" as const, route: "/(supervisor)/workshop" },
            { label: "Team", icon: "users" as const, route: "/(supervisor)/technicians" },
          ].map(({ label, icon, route }) => (
            <Pressable
              key={label}
              onPress={() => router.push(route as any)}
              style={({ pressed }) => [styles.quickActionBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1, shadowColor: "#000" }]}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.accent }]}>
                <Feather name={icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  logoutBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpiCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 4, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  kpiIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  kpiValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  kpiLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  techCard: { borderRadius: 14, borderWidth: 1.5, overflow: "hidden", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  activeLine: { height: 3 },
  techRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  techInfo: { flex: 1, gap: 2 },
  techNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  techName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  techRole: { fontSize: 12, fontFamily: "Inter_400Regular" },
  techJob: { fontSize: 12, fontFamily: "Inter_500Medium" },
  techStats: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, flexWrap: "wrap" },
  techStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  techStatText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  effBar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden", minWidth: 60 },
  effFill: { height: "100%", borderRadius: 2 },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickActionBtn: { width: "47%", borderRadius: 14, padding: 16, alignItems: "center", gap: 10, borderWidth: 1.5, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  quickActionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});
