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
import { useStages } from "@/context/StagesContext";
import { useColors } from "@/hooks/useColors";

const TECH_STATUS_CONFIG = {
  active:  { color: "#16a34a", bg: "#dcfce7", label: "Active",  icon: "zap"          as const },
  idle:    { color: "#64748b", bg: "#f1f5f9", label: "Idle",    icon: "pause-circle" as const },
  break:   { color: "#d97706", bg: "#fef3c7", label: "Break",   icon: "coffee"       as const },
  absent:  { color: "#ef4444", bg: "#fee2e2", label: "Absent",  icon: "x-circle"     as const },
};

export default function LiveSupervisionScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { state } = useJobs();
  const { logout } = useAuth();
  const router  = useRouter();
  const { getStage } = useStages();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const active   = state.technicians.filter((t) => t.status === "active").length;
  const idle     = state.technicians.filter((t) => t.status === "idle").length;
  const onBreak  = state.technicians.filter((t) => t.status === "break").length;
  const openJobs = state.jobs.filter((j) => j.status !== "completed").length;
  const onHold   = state.jobs.filter((j) => j.status === "on_hold").length;

  // Compute delayed jobs
  const delayedJobs = state.jobs.filter((job) => {
    if (job.status === "completed" || job.status === "on_hold") return false;
    const stage = getStage(job.currentStageId);
    const entry = [...(job.stageHistory ?? [])].reverse().find((e) => e.stageId === job.currentStageId);
    if (!stage || !entry) return false;
    const hoursIn = (Date.now() - new Date(entry.enteredAt).getTime()) / 3600000;
    return hoursIn > stage.expectedHours;
  });

  // Compute overloaded techs (today > 80% of 8h)
  const overloadedTechs = state.technicians.filter(
    (t) => t.status !== "absent" && (t.totalHoursToday / 8) >= 0.8,
  );

  const hasAlerts = delayedJobs.length > 0 || overloadedTechs.length > 0 || onHold > 0;

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

        {/* ── SUPERVISOR ALERTS ────────────────────────── */}
        {hasAlerts && (
          <View style={styles.alertsContainer}>
            {delayedJobs.length > 0 && (
              <Pressable
                onPress={() => router.push("/(supervisor)/jobs" as any)}
                style={[styles.alertCard, { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }]}
              >
                <View style={[styles.alertIcon, { backgroundColor: "#fed7aa" }]}>
                  <Feather name="alert-triangle" size={16} color="#f97316" />
                </View>
                <View style={styles.alertBody}>
                  <Text style={[styles.alertTitle, { color: "#f97316" }]}>
                    {delayedJobs.length} Job{delayedJobs.length !== 1 ? "s" : ""} Overdue
                  </Text>
                  <Text style={styles.alertDesc}>
                    {delayedJobs.map((j) => j.estimateNumber).join(", ")} — needs attention
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="#f97316" />
              </Pressable>
            )}

            {overloadedTechs.length > 0 && (
              <Pressable
                onPress={() => router.push("/(supervisor)/workshop" as any)}
                style={[styles.alertCard, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}
              >
                <View style={[styles.alertIcon, { backgroundColor: "#fde68a" }]}>
                  <Feather name="bar-chart-2" size={16} color="#d97706" />
                </View>
                <View style={styles.alertBody}>
                  <Text style={[styles.alertTitle, { color: "#d97706" }]}>
                    {overloadedTechs.length} Tech{overloadedTechs.length !== 1 ? "s" : ""} Near Capacity
                  </Text>
                  <Text style={styles.alertDesc}>
                    {overloadedTechs.map((t) => t.name.split(" ")[0]).join(", ")} — workshop loading high
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="#d97706" />
              </Pressable>
            )}

            {onHold > 0 && (
              <Pressable
                onPress={() => router.push("/(supervisor)/jobs" as any)}
                style={[styles.alertCard, { backgroundColor: "#fefce8", borderColor: "#fef08a" }]}
              >
                <View style={[styles.alertIcon, { backgroundColor: "#fef08a" }]}>
                  <Feather name="pause-circle" size={16} color="#ca8a04" />
                </View>
                <View style={styles.alertBody}>
                  <Text style={[styles.alertTitle, { color: "#ca8a04" }]}>
                    {onHold} Job{onHold !== 1 ? "s" : ""} On Hold
                  </Text>
                  <Text style={styles.alertDesc}>Waiting for parts or approval</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#ca8a04" />
              </Pressable>
            )}
          </View>
        )}

        {/* ── KPI CARDS ─────────────────────────────────── */}
        <View style={styles.kpiRow}>
          {[
            { label: "Active",    value: active,    color: "#16a34a", bg: "#dcfce7", icon: "zap"       as const },
            { label: "On Break",  value: onBreak,   color: "#d97706", bg: "#fef3c7", icon: "coffee"    as const },
            { label: "Idle",      value: idle,      color: "#64748b", bg: "#f1f5f9", icon: "pause"     as const },
            { label: "Open Jobs", value: openJobs,  color: colors.primary, bg: colors.accent, icon: "briefcase" as const },
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

        {/* ── TECHNICIANS ON FLOOR ──────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Technicians on Floor</Text>
        {state.technicians.map((tech) => {
          const cfg        = TECH_STATUS_CONFIG[tech.status];
          const currentJob = tech.currentJobId ? state.jobs.find((j) => j.id === tech.currentJobId) : null;
          const loadPct    = (tech.totalHoursToday / 8) * 100;
          const loadColor  = loadPct >= 90 ? "#ef4444" : loadPct >= 75 ? "#d97706" : "#16a34a";
          return (
            <Pressable
              key={tech.id}
              onPress={() => router.push("/(supervisor)/technicians" as any)}
              style={[styles.techCard, { backgroundColor: colors.card, borderColor: tech.status === "active" ? colors.primary : colors.border, shadowColor: "#000" }]}
            >
              {tech.status === "active" && <View style={[styles.activeLine, { backgroundColor: colors.primary }]} />}
              <View style={styles.techRow}>
                <View style={[styles.avatar, { backgroundColor: tech.status === "absent" ? colors.muted : colors.primary }]}>
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
                      → {currentJob.estimateNumber} · {currentJob.vehicle}
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
                  <Text style={[styles.techStatText, { color: colors.mutedForeground }]}>{tech.efficiency}% eff.</Text>
                </View>
                {tech.status !== "absent" && (
                  <>
                    <View style={[styles.effBar, { backgroundColor: colors.secondary }]}>
                      <View
                        style={[styles.effFill, { width: `${Math.min(loadPct, 100)}%` as `${number}%`, backgroundColor: loadColor }]}
                      />
                    </View>
                    <Text style={[styles.techStatText, { color: loadColor, fontFamily: "Inter_600SemiBold" }]}>
                      {loadPct.toFixed(0)}% load
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          );
        })}

        {/* ── QUICK ACTIONS ─────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {[
            { label: "Assign Job",      icon: "plus-circle"  as const, route: "/(supervisor)/jobs" },
            { label: "View All Jobs",   icon: "list"         as const, route: "/(supervisor)/jobs" },
            { label: "Workshop Load",   icon: "bar-chart-2"  as const, route: "/(supervisor)/workshop" },
            { label: "Team",            icon: "users"        as const, route: "/(supervisor)/technicians" },
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
  screen:           { flex: 1 },
  scroll:           { flex: 1 },
  content:          { padding: 16, gap: 14 },
  logoutBtn:        { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },

  alertsContainer:  { gap: 8 },
  alertCard:        { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 12 },
  alertIcon:        { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  alertBody:        { flex: 1, gap: 2 },
  alertTitle:       { fontSize: 14, fontFamily: "Inter_700Bold" },
  alertDesc:        { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6b7280" },

  kpiRow:           { flexDirection: "row", gap: 8 },
  kpiCard:          { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 4, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  kpiIcon:          { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  kpiValue:         { fontSize: 20, fontFamily: "Inter_700Bold" },
  kpiLabel:         { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },

  sectionTitle:     { fontSize: 17, fontFamily: "Inter_700Bold" },

  techCard:         { borderRadius: 14, borderWidth: 1.5, overflow: "hidden", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  activeLine:       { height: 3 },
  techRow:          { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingBottom: 10 },
  avatar:           { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText:       { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  techInfo:         { flex: 1, gap: 2 },
  techNameRow:      { flexDirection: "row", alignItems: "center", gap: 8 },
  techName:         { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusBadge:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText:  { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  techRole:         { fontSize: 12, fontFamily: "Inter_400Regular" },
  techJob:          { fontSize: 12, fontFamily: "Inter_500Medium" },
  techStats:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, flexWrap: "wrap" },
  techStat:         { flexDirection: "row", alignItems: "center", gap: 4 },
  techStatText:     { fontSize: 11, fontFamily: "Inter_400Regular" },
  effBar:           { flex: 1, height: 4, borderRadius: 2, overflow: "hidden", minWidth: 40 },
  effFill:          { height: "100%", borderRadius: 2 },

  quickActions:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickActionBtn:   { width: "47%", borderRadius: 14, padding: 16, alignItems: "center", gap: 10, borderWidth: 1.5, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  quickActionIcon:  { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  quickActionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});
