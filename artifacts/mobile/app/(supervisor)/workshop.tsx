import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useJobs } from "@/context/JobsContext";
import { useStages } from "@/context/StagesContext";
import { useColors } from "@/hooks/useColors";

const DAY_CAP   = 8;    // hours
const WEEK_CAP  = 40;   // hours
const MONTH_CAP = 160;  // hours

type CapView = "day" | "week" | "month";

function CapBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <View style={capStyles.track}>
      <View style={[capStyles.fill, { width: `${pct}%` as `${number}%`, backgroundColor: color }]} />
    </View>
  );
}

const capStyles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: "#e2e8f0", overflow: "hidden" },
  fill:  { height: "100%", borderRadius: 4 },
});

function capacityColor(pct: number) {
  if (pct >= 100) return "#ef4444";
  if (pct >= 80)  return "#f97316";
  if (pct >= 60)  return "#d97706";
  return "#16a34a";
}

function capacityLabel(pct: number) {
  if (pct >= 100) return "Fully Booked";
  if (pct >= 80)  return "Nearly Full";
  if (pct >= 60)  return "Busy";
  return "Available";
}

export default function WorkshopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useJobs();
  const { getStage } = useStages();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [capView, setCapView] = useState<CapView>("day");

  const activeTechs = state.technicians.filter((t) => t.status !== "absent");
  const totalDayHours = state.technicians.reduce((s, t) => s + t.totalHoursToday, 0);

  // Capacity computations per tech
  const techCapacity = state.technicians.map((tech) => {
    const dayHours   = tech.totalHoursToday;
    const weekHours  = tech.weekHoursBooked;
    const monthHours = tech.monthHoursBooked;
    return {
      ...tech,
      dayPct:   (dayHours / DAY_CAP) * 100,
      weekPct:  (weekHours / WEEK_CAP) * 100,
      monthPct: (monthHours / MONTH_CAP) * 100,
      dayHours, weekHours, monthHours,
    };
  });

  // Alert conditions
  const fullyBookedDay   = techCapacity.filter((t) => t.dayPct >= 100 && t.status !== "absent");
  const nearlyBookedDay  = techCapacity.filter((t) => t.dayPct >= 80 && t.dayPct < 100 && t.status !== "absent");
  const fullyBookedWeek  = techCapacity.filter((t) => t.weekPct >= 100 && t.status !== "absent");
  const nearlyBookedWeek = techCapacity.filter((t) => t.weekPct >= 80 && t.weekPct < 100 && t.status !== "absent");
  const fullyBookedMonth = techCapacity.filter((t) => t.monthPct >= 100 && t.status !== "absent");

  // Delayed jobs
  const delayedJobs = state.jobs.filter((job) => {
    if (job.status === "completed" || job.status === "on_hold") return false;
    const stage = getStage(job.currentStageId);
    const entry = [...(job.stageHistory ?? [])].reverse().find((e) => e.stageId === job.currentStageId);
    if (!stage || !entry) return false;
    const hoursIn = (Date.now() - new Date(entry.enteredAt).getTime()) / 3600000;
    return hoursIn > stage.expectedHours;
  }).map((job) => {
    const stage = getStage(job.currentStageId);
    const entry = [...(job.stageHistory ?? [])].reverse().find((e) => e.stageId === job.currentStageId);
    const hoursIn = entry ? (Date.now() - new Date(entry.enteredAt).getTime()) / 3600000 : 0;
    const overdueHours = stage ? Math.max(0, hoursIn - stage.expectedHours) : 0;
    return { ...job, overdueHours, stageName: stage?.name ?? "" };
  });

  const jobsByStatus = {
    pending:     state.jobs.filter((j) => j.status === "pending").length,
    in_progress: state.jobs.filter((j) => j.status === "in_progress").length,
    on_hold:     state.jobs.filter((j) => j.status === "on_hold").length,
    completed:   state.jobs.filter((j) => j.status === "completed").length,
  };

  const avgEfficiency = activeTechs.length > 0
    ? Math.round(activeTechs.reduce((s, t) => s + t.efficiency, 0) / activeTechs.length)
    : 0;

  const getHoursForView = (tech: typeof techCapacity[0]) =>
    capView === "day" ? tech.dayHours : capView === "week" ? tech.weekHours : tech.monthHours;
  const getCapForView = () =>
    capView === "day" ? DAY_CAP : capView === "week" ? WEEK_CAP : MONTH_CAP;
  const getPctForView = (tech: typeof techCapacity[0]) =>
    capView === "day" ? tech.dayPct : capView === "week" ? tech.weekPct : tech.monthPct;

  const hasAlerts = fullyBookedDay.length > 0 || fullyBookedWeek.length > 0 || delayedJobs.length > 0;
  const hasWarnings = nearlyBookedDay.length > 0 || nearlyBookedWeek.length > 0 || fullyBookedMonth.length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Workshop Loading" subtitle="Capacity & Delay Dashboard" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── ALERT BANNERS ─────────────────────────────── */}
        {hasAlerts && (
          <View style={[styles.alertSection, { borderColor: "#fca5a5", backgroundColor: "#fef2f2" }]}>
            <View style={styles.alertHeader}>
              <View style={[styles.alertIconWrap, { backgroundColor: "#fca5a5" }]}>
                <Feather name="alert-octagon" size={14} color="#ef4444" />
              </View>
              <Text style={[styles.alertTitle, { color: "#ef4444" }]}>Critical Alerts</Text>
            </View>
            {fullyBookedDay.map((t) => (
              <View key={`day-full-${t.id}`} style={styles.alertRow}>
                <View style={[styles.alertDot, { backgroundColor: "#ef4444" }]} />
                <Text style={styles.alertText}>
                  <Text style={styles.alertBold}>{t.name}</Text> is fully booked today ({t.dayHours.toFixed(1)}h / {DAY_CAP}h)
                </Text>
              </View>
            ))}
            {fullyBookedWeek.map((t) => (
              <View key={`week-full-${t.id}`} style={styles.alertRow}>
                <View style={[styles.alertDot, { backgroundColor: "#ef4444" }]} />
                <Text style={styles.alertText}>
                  <Text style={styles.alertBold}>{t.name}</Text> is fully booked this week ({t.weekHours}h / {WEEK_CAP}h)
                </Text>
              </View>
            ))}
            {delayedJobs.map((job) => (
              <View key={`delay-${job.id}`} style={styles.alertRow}>
                <View style={[styles.alertDot, { backgroundColor: "#f97316" }]} />
                <Text style={styles.alertText}>
                  <Text style={styles.alertBold}>{job.estimateNumber}</Text> {job.vehicle} — {job.stageName} overdue by {job.overdueHours.toFixed(1)}h
                </Text>
              </View>
            ))}
          </View>
        )}

        {hasWarnings && (
          <View style={[styles.alertSection, { borderColor: "#fde68a", backgroundColor: "#fffbeb" }]}>
            <View style={styles.alertHeader}>
              <View style={[styles.alertIconWrap, { backgroundColor: "#fde68a" }]}>
                <Feather name="alert-triangle" size={14} color="#d97706" />
              </View>
              <Text style={[styles.alertTitle, { color: "#d97706" }]}>Capacity Warnings</Text>
            </View>
            {nearlyBookedDay.map((t) => (
              <View key={`day-warn-${t.id}`} style={styles.alertRow}>
                <View style={[styles.alertDot, { backgroundColor: "#d97706" }]} />
                <Text style={styles.alertText}>
                  <Text style={styles.alertBold}>{t.name}</Text> nearly full today ({t.dayHours.toFixed(1)}h / {DAY_CAP}h — {t.dayPct.toFixed(0)}%)
                </Text>
              </View>
            ))}
            {nearlyBookedWeek.map((t) => (
              <View key={`week-warn-${t.id}`} style={styles.alertRow}>
                <View style={[styles.alertDot, { backgroundColor: "#d97706" }]} />
                <Text style={styles.alertText}>
                  <Text style={styles.alertBold}>{t.name}</Text> nearly full this week ({t.weekHours}h / {WEEK_CAP}h — {t.weekPct.toFixed(0)}%)
                </Text>
              </View>
            ))}
            {fullyBookedMonth.map((t) => (
              <View key={`month-full-${t.id}`} style={styles.alertRow}>
                <View style={[styles.alertDot, { backgroundColor: "#ef4444" }]} />
                <Text style={styles.alertText}>
                  <Text style={styles.alertBold}>{t.name}</Text> fully booked this month ({t.monthHours}h / {MONTH_CAP}h)
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── KPI SUMMARY ───────────────────────────────── */}
        <View style={styles.kpiRow}>
          {[
            { label: "Hours\nToday",      value: `${totalDayHours.toFixed(1)}h`, icon: "clock"       as const, color: colors.primary },
            { label: "Active\nTechs",     value: `${state.technicians.filter((t) => t.status === "active").length}`, icon: "users" as const, color: colors.success },
            { label: "Avg\nEfficiency",   value: `${avgEfficiency}%`,            icon: "trending-up" as const, color: colors.info },
            { label: "Delayed\nJobs",     value: `${delayedJobs.length}`,        icon: "alert-triangle" as const, color: delayedJobs.length > 0 ? "#f97316" : colors.success },
          ].map(({ label, value, icon, color }) => (
            <View key={label} style={[styles.kpiCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
              <View style={[styles.kpiIcon, { backgroundColor: color + "20" }]}>
                <Feather name={icon} size={16} color={color} />
              </View>
              <Text style={[styles.kpiValue, { color }]}>{value}</Text>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── TECHNICIAN CAPACITY ───────────────────────── */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Technician Capacity</Text>
            <View style={[styles.viewToggle, { backgroundColor: colors.secondary }]}>
              {(["day", "week", "month"] as CapView[]).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setCapView(v)}
                  style={[styles.viewToggleBtn, capView === v && [styles.viewToggleBtnActive, { backgroundColor: colors.primary }]]}
                >
                  <Text style={[styles.viewToggleBtnText, { color: capView === v ? "#fff" : colors.mutedForeground }]}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.capLegend, { borderColor: colors.border }]}>
            {[["#16a34a", "Available (<60%)"], ["#d97706", "Busy (60-80%)"], ["#f97316", "Nearly Full (80-100%)"], ["#ef4444", "Fully Booked (≥100%)"]].map(([color, label]) => (
              <View key={label} style={styles.capLegendItem}>
                <View style={[styles.capLegendDot, { backgroundColor: color }]} />
                <Text style={[styles.capLegendText, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
            ))}
          </View>

          {techCapacity.map((tech) => {
            const hours  = getHoursForView(tech);
            const cap    = getCapForView();
            const pct    = getPctForView(tech);
            const color  = tech.status === "absent" ? colors.border : capacityColor(pct);
            const label  = tech.status === "absent" ? "Absent" : capacityLabel(pct);
            const assignedJobs = state.jobs.filter((j) => j.assignedTechnicianId === tech.id && j.status !== "completed").length;

            return (
              <View key={tech.id} style={styles.techCapRow}>
                <View style={[styles.techAvatar, { backgroundColor: tech.status === "absent" ? colors.muted : colors.primary }]}>
                  <Text style={styles.techAvatarText}>{tech.avatar}</Text>
                </View>
                <View style={styles.techCapInfo}>
                  <View style={styles.techCapHeader}>
                    <Text style={[styles.techCapName, { color: colors.foreground }]}>{tech.name}</Text>
                    <View style={styles.techCapRight}>
                      <View style={[styles.capStatusBadge, { backgroundColor: color + "20" }]}>
                        <Text style={[styles.capStatusText, { color }]}>{label}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.techCapSubRow}>
                    <Text style={[styles.techCapSub, { color: colors.mutedForeground }]}>
                      {hours.toFixed(1)}h / {cap}h {capView} · {assignedJobs} active job{assignedJobs !== 1 ? "s" : ""}
                    </Text>
                    <Text style={[styles.techCapPct, { color }]}>{pct.toFixed(0)}%</Text>
                  </View>
                  <CapBar value={hours} max={cap} color={color} />
                </View>
              </View>
            );
          })}
        </View>

        {/* ── DELAYED JOBS ─────────────────────────────── */}
        {delayedJobs.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, shadowColor: "#000" }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Overdue Jobs</Text>
              <View style={[styles.countBadge, { backgroundColor: "#fff7ed" }]}>
                <Text style={[styles.countBadgeText, { color: "#f97316" }]}>{delayedJobs.length}</Text>
              </View>
            </View>
            {delayedJobs.map((job) => {
              const tech = job.assignedTechnicianId
                ? state.technicians.find((t) => t.id === job.assignedTechnicianId)
                : null;
              return (
                <View key={job.id} style={[styles.delayCard, { borderColor: "#fed7aa", backgroundColor: "#fff7ed" }]}>
                  <View style={styles.delayCardLeft}>
                    <Text style={styles.delayEstimate}>{job.estimateNumber}</Text>
                    <Text style={[styles.delayVehicle, { color: colors.mutedForeground }]}>{job.vehicle}</Text>
                    <Text style={styles.delayStage}>{job.stageName} · {job.overdueHours.toFixed(1)}h overdue</Text>
                  </View>
                  {tech && (
                    <View style={[styles.delayTechAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.techAvatarText}>{tech.avatar}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── JOB PIPELINE ─────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Job Pipeline</Text>
          <View style={styles.pipeline}>
            {[
              { label: "Pending",     count: jobsByStatus.pending,     color: colors.warning,     icon: "clock"       as const },
              { label: "In Progress", count: jobsByStatus.in_progress, color: colors.info,        icon: "activity"    as const },
              { label: "On Hold",     count: jobsByStatus.on_hold,     color: "#d97706",          icon: "pause-circle" as const },
              { label: "Done",        count: jobsByStatus.completed,   color: colors.success,     icon: "check-circle" as const },
            ].map(({ label, count, color, icon }, i, arr) => (
              <View key={label} style={styles.pipelineItem}>
                <View style={[styles.pipelineCard, { backgroundColor: color + "15", borderColor: color + "40" }]}>
                  <Feather name={icon} size={18} color={color} />
                  <Text style={[styles.pipelineCount, { color }]}>{count}</Text>
                </View>
                <Text style={[styles.pipelineLabel, { color: colors.mutedForeground }]}>{label}</Text>
                {i < arr.length - 1 && (
                  <Feather name="arrow-right" size={12} color={colors.border} style={styles.pipelineArrow} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* ── PRODUCTION STAGES PER TECH ───────────────── */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Production by Technician</Text>
          {state.technicians.filter((t) => t.status !== "absent").map((tech) => {
            const jobs = state.jobs.filter((j) => j.assignedTechnicianId === tech.id);
            if (jobs.length === 0) return (
              <View key={tech.id} style={[styles.stageRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.stageTechName, { color: colors.foreground }]}>{tech.name}</Text>
                <Text style={[styles.stageNoJobs, { color: colors.mutedForeground }]}>No active jobs</Text>
              </View>
            );
            return (
              <View key={tech.id} style={[styles.stageRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.stageTechName, { color: colors.foreground }]}>{tech.name}</Text>
                <View style={styles.stageBadges}>
                  {jobs.map((j) => {
                    const bgColor = j.status === "completed" ? colors.successLight : j.status === "on_hold" ? "#fef3c7" : j.status === "in_progress" ? colors.infoLight : colors.warningLight;
                    const txtColor = j.status === "completed" ? colors.success : j.status === "on_hold" ? "#d97706" : j.status === "in_progress" ? colors.info : colors.warning;
                    return (
                      <View key={j.id} style={[styles.stageBadge, { backgroundColor: bgColor }]}>
                        <Text style={[styles.stageBadgeText, { color: txtColor }]}>{j.estimateNumber}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:               { flex: 1 },
  scroll:               { flex: 1 },
  content:              { padding: 16, gap: 14 },

  alertSection:         { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10 },
  alertHeader:          { flexDirection: "row", alignItems: "center", gap: 8 },
  alertIconWrap:        { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  alertTitle:           { fontSize: 14, fontFamily: "Inter_700Bold" },
  alertRow:             { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  alertDot:             { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  alertText:            { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 18 },
  alertBold:            { fontFamily: "Inter_600SemiBold" },

  kpiRow:               { flexDirection: "row", gap: 8 },
  kpiCard:              { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 4, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  kpiIcon:              { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  kpiValue:             { fontSize: 16, fontFamily: "Inter_700Bold" },
  kpiLabel:             { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "center" },

  section:              { borderRadius: 14, padding: 16, gap: 14, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionHeader:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  sectionTitle:         { fontSize: 17, fontFamily: "Inter_700Bold" },
  countBadge:           { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countBadgeText:       { fontSize: 13, fontFamily: "Inter_700Bold" },

  viewToggle:           { flexDirection: "row", borderRadius: 10, overflow: "hidden", padding: 2 },
  viewToggleBtn:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  viewToggleBtnActive:  {},
  viewToggleBtnText:    { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  capLegend:            { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1 },
  capLegendItem:        { flexDirection: "row", alignItems: "center", gap: 4 },
  capLegendDot:         { width: 8, height: 8, borderRadius: 4 },
  capLegendText:        { fontSize: 10, fontFamily: "Inter_400Regular" },

  techCapRow:           { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  techAvatar:           { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  techAvatarText:       { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  techCapInfo:          { flex: 1, gap: 5 },
  techCapHeader:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  techCapRight:         { flexDirection: "row", alignItems: "center", gap: 6 },
  techCapName:          { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  capStatusBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  capStatusText:        { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  techCapSubRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  techCapSub:           { fontSize: 11, fontFamily: "Inter_400Regular" },
  techCapPct:           { fontSize: 13, fontFamily: "Inter_700Bold" },

  delayCard:            { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12, gap: 12 },
  delayCardLeft:        { flex: 1, gap: 3 },
  delayEstimate:        { fontSize: 14, fontFamily: "Inter_700Bold", color: "#374151" },
  delayVehicle:         { fontSize: 12, fontFamily: "Inter_400Regular" },
  delayStage:           { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#f97316" },
  delayTechAvatar:      { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  pipeline:             { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap" },
  pipelineItem:         { alignItems: "center", gap: 6, position: "relative" },
  pipelineCard:         { width: 68, height: 68, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  pipelineCount:        { fontSize: 20, fontFamily: "Inter_700Bold" },
  pipelineLabel:        { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center", maxWidth: 68 },
  pipelineArrow:        { position: "absolute", right: -12, top: 26 },

  stageRow:             { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  stageTechName:        { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 90 },
  stageNoJobs:          { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  stageBadges:          { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stageBadge:           { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  stageBadgeText:       { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
