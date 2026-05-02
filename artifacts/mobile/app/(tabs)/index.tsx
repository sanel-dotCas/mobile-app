import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
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
import { JobCard } from "@/components/JobCard";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ProgressBar } from "@/components/ProgressBar";
import { useJobs } from "@/context/JobsContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

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
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const today = new Date("2026-04-30");
  const [calYear] = useState(today.getFullYear());
  const [calMonth] = useState(today.getMonth());
  const calDays = getCalendarDays(calYear, calMonth);

  const activeJobs = state.jobs.filter((j) => j.status === "in_progress");
  const pendingJobs = state.jobs.filter((j) => j.status === "pending");
  const completedJobs = state.jobs.filter((j) => j.status === "completed");

  function getDayPattern(day: number | null): "worked" | "partial" | "off" | "today" | "none" {
    if (!day) return "none";
    const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    if (isToday) return "today";
    return state.stats.workingPattern[key] ?? "off";
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t.dashboard}
        subtitle={t.assignedJobs}
        rightElement={
          <View style={styles.headerActions}>
            <LanguagePicker />
            <Pressable style={[styles.exportBtn, { borderColor: colors.border }]}>
              <Feather name="download" size={14} color={colors.foreground} />
              <Text style={[styles.exportBtnText, { color: colors.foreground }]}>{t.export}</Text>
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
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Total time tracked</Text>
              <Text style={[styles.kpiValue, { color: colors.foreground }]}>{state.stats.totalTimeTracked}</Text>
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
          {[
            { label: "Active", count: activeJobs.length, color: colors.info, icon: "activity" as const },
            { label: "Pending", count: pendingJobs.length, color: colors.warning, icon: "clock" as const },
            { label: "Completed", count: completedJobs.length, color: colors.success, icon: "check-circle" as const },
          ].map(({ label, count, color, icon }) => (
            <View key={label} style={[styles.statCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
              <View style={[styles.statIconBg, { backgroundColor: color + "20" }]}>
                <Feather name={icon} size={16} color={color} />
              </View>
              <Text style={[styles.statCount, { color: colors.foreground }]}>{count}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
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
          {state.jobs.slice(0, 3).map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
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
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  exportBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
    gap: 10,
  },
  statCard: {
    flex: 1,
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
    fontSize: 11,
    fontFamily: "Inter_500Medium",
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
});
