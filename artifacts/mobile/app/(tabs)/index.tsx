import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { JobCard } from "@/components/JobCard";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ProgressBar } from "@/components/ProgressBar";
import { useAuth } from "@/context/AuthContext";
import { useJobs } from "@/context/JobsContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";


const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["S","M","T","W","T","F","S"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<number | null> = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useJobs();
  const { t } = useLang();
  const { logout, technicianName } = useAuth();
  const router = useRouter();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const today = new Date();
  const [calYear] = useState(today.getFullYear());
  const [calMonth] = useState(today.getMonth());
  const calDays = getCalendarDays(calYear, calMonth);

  const [myInspectionsCount, setMyInspectionsCount] = useState<number | null>(null);

  const loadInspectionCount = useCallback(async () => {
    if (!technicianName) {
      setMyInspectionsCount(0);
      return;
    }
    try {
      const params = new URLSearchParams({
        assignedTo: technicianName,
        status: "queued,in-progress",
        limit: "50",
      });
      const res = await fetch(`${BASE}/yard/inspections?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMyInspectionsCount((data.inspections ?? []).length);
    } catch {
      setMyInspectionsCount(null);
    }
  }, [technicianName]);

  useEffect(() => { loadInspectionCount(); }, [loadInspectionCount]);

  const activeJobs = state.jobs.filter((j) => j.status === "in_progress");
  const pendingJobs = state.jobs.filter((j) => j.status === "pending");
  const completedJobs = state.jobs.filter((j) => j.status === "completed");

  const [liveNow, setLiveNow] = useState(Date.now());
  const liveTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.activeClockIn) {
      if (!liveTickRef.current) {
        liveTickRef.current = setInterval(() => setLiveNow(Date.now()), 1000);
      }
    } else {
      if (liveTickRef.current) {
        clearInterval(liveTickRef.current);
        liveTickRef.current = null;
      }
    }
    return () => {
      if (liveTickRef.current) {
        clearInterval(liveTickRef.current);
        liveTickRef.current = null;
      }
    };
  }, [state.activeClockIn]);

  const liveTimeTracked = useMemo(() => {
    if (!state.activeClockIn) return state.stats.totalTimeTracked;
    const incrementalSeconds = Math.max(
      0,
      Math.floor((liveNow - state.statsRefreshedAt) / 1000),
    );
    const total = state.stats.totalTimeTrackedSeconds + incrementalSeconds;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}h ${m}m`;
  }, [state.activeClockIn, state.stats.totalTimeTrackedSeconds, state.statsRefreshedAt, liveNow]);

  function getDayPattern(day: number | null): "worked" | "partial" | "off" | "today" | "none" {
    if (!day) return "none";
    const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    if (isToday) return "today";
    return state.stats.workingPattern[key] ?? "off";
  }

  const statsRow = [
    { label: "Active", count: activeJobs.length, color: colors.info, icon: "activity" as const, onPress: undefined as (() => void) | undefined },
    { label: "Pending", count: pendingJobs.length, color: colors.warning, icon: "clock" as const, onPress: undefined as (() => void) | undefined },
    { label: "Completed", count: completedJobs.length, color: colors.success, icon: "check-circle" as const, onPress: undefined as (() => void) | undefined },
    {
      label: "Inspections",
      count: myInspectionsCount ?? 0,
      color: "#7c3aed",
      icon: "clipboard" as const,
      onPress: (): void => { router.push("/(tabs)/jobs"); },
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t.dashboard}
        subtitle={t.assignedJobs}
        rightElement={
          <View style={styles.headerActions}>
            <LanguagePicker />
            <Pressable
              onPress={logout}
              style={[styles.logoutBtn, { borderColor: colors.border }]}
              hitSlop={8}
            >
              <Feather name="log-out" size={15} color={colors.mutedForeground} />
            </Pressable>
          </View>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Card */}
        <View style={[styles.kpiCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <View style={styles.kpiLabelRow}>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Total time tracked</Text>
                {state.activeClockIn && (
                  <View style={[styles.liveBadge, { backgroundColor: colors.success + "20" }]}>
                    <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.liveText, { color: colors.success }]}>LIVE</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>{liveTimeTracked}</Text>
            </View>
            <View style={[styles.kpiDivider, { backgroundColor: colors.border }]} />
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Productivity</Text>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>{state.stats.productivity}%</Text>
            </View>
          </View>
          <ProgressBar progress={state.stats.productivity} height={10} showLabel={false} />
          <View style={[styles.tipRow, { backgroundColor: colors.accent }]}>
            <View style={[styles.tipIcon, { backgroundColor: colors.primary }]}>
              <Feather name="zap" size={13} color="#fff" />
            </View>
            <Text style={[styles.tipText, { color: colors.mutedForeground }]} numberOfLines={2}>
              Tip: Do your most important tasks first to boost your productivity rating.
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {statsRow.map(({ label, count, color, icon, onPress }) => (
            <Pressable
              key={label}
              style={[styles.statCard, { backgroundColor: colors.card, shadowColor: "#000" }]}
              onPress={onPress}
              disabled={!onPress}
            >
              <View style={[styles.statIconBg, { backgroundColor: color + "20" }]}>
                <Feather name={icon} size={16} color={color} />
              </View>
              {state.jobsLoaded ? (
                <Text style={[styles.statCount, { color: colors.foreground }]}>
                  {label === "Inspections" && myInspectionsCount === null ? "—" : count}
                </Text>
              ) : (
                <View style={[styles.skeletonCount, { backgroundColor: colors.border }]} />
              )}
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Working Pattern Calendar */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Working Pattern</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              {MONTHS[calMonth]} {calYear}
            </Text>
          </View>
          <View style={styles.calGrid}>
            {DAYS.map((d, i) => (
              <Text key={i} style={[styles.dayLabel, { color: colors.mutedForeground }]}>{d}</Text>
            ))}
            {calDays.map((day, idx) => {
              const pattern = getDayPattern(day);
              return (
                <View key={idx} style={styles.calCell}>
                  {day && (
                    <View
                      style={[
                        styles.calDay,
                        pattern === "today" && { backgroundColor: colors.primary },
                        pattern === "worked" && { backgroundColor: "#22c55e40" },
                        pattern === "partial" && { backgroundColor: "#3b82f640" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calDayText,
                          { color: pattern === "today" ? "#fff" : colors.foreground },
                          pattern === "worked" && { color: colors.success },
                          pattern === "partial" && { color: colors.info },
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            {[
              { label: "Worked", color: "#22c55e40", textColor: colors.success },
              { label: "Partial", color: "#3b82f640", textColor: colors.info },
              { label: "Today", color: colors.primary, textColor: "#fff" },
            ].map(({ label, color, textColor }) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]}>
                  <Text style={[styles.legendDotText, { color: textColor }]}>·</Text>
                </View>
                <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Jobs */}
        <View style={styles.jobsSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Assigned Jobs</Text>
          {!state.jobsLoaded ? (
            <View style={[styles.loadingJobsContainer, { backgroundColor: colors.card }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingJobsText, { color: colors.mutedForeground }]}>Loading jobs…</Text>
            </View>
          ) : (
            state.jobs.slice(0, 3).map((job) => (
              <JobCard key={job.id} job={job} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiCard: {
    borderRadius: 14,
    padding: 16,
    gap: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  kpiItem: {
    flex: 1,
    gap: 2,
  },
  kpiDivider: {
    width: 1,
    alignSelf: "stretch",
  },
  kpiLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  kpiLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  kpiValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    lineHeight: 34,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    padding: 10,
  },
  tipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 70,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 6,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statCount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  section: {
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    paddingVertical: 4,
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  calDay: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  calDayText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  legendDotText: {
    fontSize: 16,
    lineHeight: 16,
  },
  legendLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  jobsSection: {
    gap: 0,
  },
  skeletonCount: {
    width: 36,
    height: 28,
    borderRadius: 6,
  },
  loadingJobsContainer: {
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingJobsText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
