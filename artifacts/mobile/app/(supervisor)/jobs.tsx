import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill } from "@/components/StatusPill";
import type { Job, JobStatus } from "@/context/JobsContext";
import { useJobs } from "@/context/JobsContext";
import { useStages } from "@/context/StagesContext";
import { useColors } from "@/hooks/useColors";

type FilterKey = "all" | "pending" | "in_progress" | "on_hold" | "completed";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all",         label: "All"         },
  { key: "pending",     label: "New"         },
  { key: "in_progress", label: "In Progress" },
  { key: "on_hold",     label: "On Hold"     },
  { key: "completed",   label: "Done"        },
];

function computeDelay(job: Job, getStage: ReturnType<typeof useStages>["getStage"]) {
  const stage = getStage(job.currentStageId);
  const entry = [...(job.stageHistory ?? [])].reverse().find((e) => e.stageId === job.currentStageId);
  if (!stage || !entry) return { isDelayed: false, overdueHours: 0, stageName: stage?.name ?? "" };
  const hoursIn = (Date.now() - new Date(entry.enteredAt).getTime()) / 3600000;
  const isDelayed = hoursIn > stage.expectedHours;
  return { isDelayed, overdueHours: Math.max(0, hoursIn - stage.expectedHours), stageName: stage.name };
}

export default function SupervisorJobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, assignJob, holdJob, unholdJob } = useJobs();
  const { getStage } = useStages();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [assignModal, setAssignModal] = useState<{ jobId: string } | null>(null);

  const filteredJobs = activeFilter === "all"
    ? state.jobs
    : state.jobs.filter((j) => j.status === activeFilter);

  const counts: Record<FilterKey, number> = {
    all:         state.jobs.length,
    pending:     state.jobs.filter((j) => j.status === "pending").length,
    in_progress: state.jobs.filter((j) => j.status === "in_progress").length,
    on_hold:     state.jobs.filter((j) => j.status === "on_hold").length,
    completed:   state.jobs.filter((j) => j.status === "completed").length,
  };

  const delayedCount = state.jobs.filter((job) => {
    if (job.status === "completed" || job.status === "on_hold") return false;
    const { isDelayed } = computeDelay(job, getStage);
    return isDelayed;
  }).length;

  const handleAssign = (jobId: string, techId: string) => {
    assignJob(jobId, techId);
    setAssignModal(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleHoldToggle = (job: Job) => {
    if (job.status === "on_hold") {
      Alert.alert(
        "Resume Job",
        `Resume ${job.estimateNumber} — ${job.vehicle}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Resume", onPress: () => { unholdJob(job.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
        ],
      );
    } else {
      Alert.alert(
        "Put Job On Hold",
        `Put ${job.estimateNumber} on hold? The technician will be notified.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Hold", style: "destructive", onPress: () => { holdJob(job.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } },
        ],
      );
    }
  };

  const FILTER_COLORS: Partial<Record<FilterKey, string>> = {
    on_hold: "#d97706",
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Job Management" subtitle={`${state.jobs.length} total jobs`} />

      {/* Delay alert banner */}
      {delayedCount > 0 && (
        <View style={[styles.alertBanner, { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }]}>
          <View style={[styles.alertIconWrap, { backgroundColor: "#fed7aa" }]}>
            <Feather name="alert-triangle" size={14} color="#f97316" />
          </View>
          <Text style={styles.alertBannerText}>
            {delayedCount} job{delayedCount !== 1 ? "s are" : " is"} overdue — tap to review
          </Text>
          <Pressable onPress={() => setActiveFilter("in_progress")} style={styles.alertLink}>
            <Text style={styles.alertLinkText}>View</Text>
          </Pressable>
        </View>
      )}

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.filterBarContent}
      >
        {FILTERS.map(({ key, label }) => {
          const active = activeFilter === key;
          const count = counts[key];
          const accentColor = FILTER_COLORS[key] ?? colors.primary;
          return (
            <Pressable
              key={key}
              onPress={() => { setActiveFilter(key); Haptics.selectionAsync(); }}
              style={[styles.filterTab, active && [styles.filterTabActive, { borderBottomColor: accentColor }]]}
            >
              <Text style={[styles.filterLabel, { color: active ? accentColor : colors.mutedForeground }]}>
                {label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: active ? accentColor : colors.muted }]}>
                  <Text style={[styles.filterBadgeText, { color: active ? "#fff" : colors.mutedForeground }]}>
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredJobs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="briefcase" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No jobs here</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {activeFilter === "all" ? "No jobs have been added yet." : `No ${FILTERS.find((f) => f.key === activeFilter)?.label} jobs right now.`}
            </Text>
          </View>
        ) : (
          filteredJobs.map((job) => {
            const tech = job.assignedTechnicianId
              ? state.technicians.find((t) => t.id === job.assignedTechnicianId)
              : null;
            const currentStage = getStage(job.currentStageId);
            const { isDelayed, overdueHours } = computeDelay(job, getStage);
            const showDelay = isDelayed && job.status !== "completed" && job.status !== "on_hold";

            const pendingParts = job.tasks.reduce(
              (s, t) => s + (t.parts ?? []).filter((p) => p.status !== "received").length,
              0,
            );
            const failedInspections = (job.inspections ?? []).filter((i) => i.status === "fail").length;

            const cardBorderColor = showDelay
              ? "#fb923c"
              : job.status === "on_hold"
              ? "#fbbf24"
              : colors.border;

            return (
              <Pressable
                key={job.id}
                onPress={() => router.push(`/job/${job.id}` as any)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.card, borderColor: cardBorderColor, shadowColor: "#000", opacity: pressed ? 0.94 : 1 },
                ]}
              >
                {/* Colored top stripe for delayed / on-hold */}
                {showDelay && <View style={[styles.cardStripe, { backgroundColor: "#f97316" }]} />}
                {job.status === "on_hold" && !showDelay && <View style={[styles.cardStripe, { backgroundColor: "#d97706" }]} />}

                {/* Header */}
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.estimateNum, { color: colors.foreground }]}>{job.estimateNumber}</Text>
                      {showDelay && (
                        <View style={styles.delayPill}>
                          <Feather name="alert-triangle" size={9} color="#f97316" />
                          <Text style={styles.delayPillText}>{overdueHours.toFixed(1)}h late</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.vehicle, { color: colors.mutedForeground }]}>{job.vehicle}</Text>
                    <View style={styles.metaRow}>
                      <Feather name="hash" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{job.licensePlate}</Text>
                      <Text style={[styles.metaDot, { color: colors.border }]}>·</Text>
                      <Feather name="clock" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{job.totalEstimatedHours}h est.</Text>
                      {pendingParts > 0 && (
                        <>
                          <Text style={[styles.metaDot, { color: colors.border }]}>·</Text>
                          <Feather name="package" size={10} color="#d97706" />
                          <Text style={[styles.metaText, { color: "#d97706" }]}>{pendingParts} parts pending</Text>
                        </>
                      )}
                      {failedInspections > 0 && (
                        <>
                          <Text style={[styles.metaDot, { color: colors.border }]}>·</Text>
                          <Feather name="x-circle" size={10} color="#dc2626" />
                          <Text style={[styles.metaText, { color: "#dc2626" }]}>{failedInspections} failed</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardTopRight}>
                    <StatusPill status={job.status} size="md" />
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginTop: 6 }} />
                  </View>
                </View>

                {/* Stage indicator */}
                {currentStage && job.status !== "completed" && (
                  <View style={[styles.stageRow, { borderTopColor: colors.border, backgroundColor: showDelay ? "#fff7ed" : colors.background }]}>
                    <View style={[styles.stageDot, { backgroundColor: currentStage.color }]}>
                      <Feather name={currentStage.icon as any} size={9} color="#fff" />
                    </View>
                    <Text style={[styles.stageName, { color: colors.foreground }]}>{currentStage.name}</Text>
                    {showDelay ? (
                      <Text style={styles.stageDelayText}>⚠ {overdueHours.toFixed(1)}h overdue</Text>
                    ) : (
                      <Text style={[styles.stageOkText, { color: colors.mutedForeground }]}>Active stage</Text>
                    )}
                  </View>
                )}

                {/* Progress bar */}
                <View style={styles.progressSection}>
                  <ProgressBar progress={job.progress} height={5} showLabel />
                </View>

                {/* Footer */}
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.techSection}>
                    {tech ? (
                      <View style={styles.techRow}>
                        <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                          <Text style={styles.techAvatarText}>{tech.avatar}</Text>
                        </View>
                        <View>
                          <Text style={[styles.techName, { color: colors.foreground }]}>{tech.name}</Text>
                          <Text style={[styles.techRoleText, { color: colors.mutedForeground }]}>{tech.role}</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.unassignedRow}>
                        <Feather name="user-x" size={13} color={colors.warning} />
                        <Text style={[styles.unassigned, { color: colors.warning }]}>Unassigned</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardActions}>
                    {job.status !== "completed" && (
                      <Pressable
                        onPress={(e) => { e.stopPropagation?.(); handleHoldToggle(job); }}
                        style={[
                          styles.holdBtn,
                          { borderColor: job.status === "on_hold" ? colors.primary : colors.border,
                            backgroundColor: job.status === "on_hold" ? colors.accent : "transparent" },
                        ]}
                      >
                        <Feather
                          name={job.status === "on_hold" ? "play" : "pause"}
                          size={13}
                          color={job.status === "on_hold" ? colors.primary : colors.mutedForeground}
                        />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); setAssignModal({ jobId: job.id }); }}
                      style={[styles.assignBtn, { backgroundColor: colors.primary }]}
                    >
                      <Feather name="user-plus" size={12} color="#fff" />
                      <Text style={styles.assignBtnText}>{tech ? "Reassign" : "Assign"}</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Assign technician modal */}
      {assignModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setAssignModal(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setAssignModal(null)}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Assign Technician</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {state.technicians.filter((t) => t.status !== "absent").map((tech) => {
                  const loadPct = (tech.totalHoursToday / 8) * 100;
                  const loadColor = loadPct >= 90 ? "#ef4444" : loadPct >= 70 ? "#d97706" : "#16a34a";
                  return (
                    <Pressable
                      key={tech.id}
                      onPress={() => handleAssign(assignModal.jobId, tech.id)}
                      style={({ pressed }) => [styles.techOption, { borderBottomColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.techAvatarText}>{tech.avatar}</Text>
                      </View>
                      <View style={styles.techOptionInfo}>
                        <Text style={[styles.techName, { color: colors.foreground }]}>{tech.name}</Text>
                        <Text style={[styles.techRoleText, { color: colors.mutedForeground }]}>
                          {tech.role} · {tech.efficiency}% eff · {tech.totalHoursToday}h today
                        </Text>
                        <View style={[styles.miniLoadTrack, { backgroundColor: colors.secondary }]}>
                          <View style={[styles.miniLoadFill, { width: `${Math.min(loadPct, 100)}%` as `${number}%`, backgroundColor: loadColor }]} />
                        </View>
                      </View>
                      <View style={[styles.statusDot, {
                        backgroundColor: tech.status === "active" ? "#16a34a" : tech.status === "idle" ? "#64748b" : "#d97706",
                      }]} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:             { flex: 1 },
  scroll:             { flex: 1 },
  content:            { padding: 16, gap: 12 },

  alertBanner:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  alertIconWrap:      { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  alertBannerText:    { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#f97316" },
  alertLink:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "#fed7aa" },
  alertLinkText:      { fontSize: 12, fontFamily: "Inter_700Bold", color: "#f97316" },

  filterBar:          { borderBottomWidth: 1, flexGrow: 0 },
  filterBarContent:   { paddingHorizontal: 12, gap: 2 },
  filterTab:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 11, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  filterTabActive:    {},
  filterLabel:        { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  filterBadge:        { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterBadgeText:    { fontSize: 10, fontFamily: "Inter_700Bold" },

  empty:              { alignItems: "center", paddingVertical: 64, gap: 10 },
  emptyTitle:         { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText:          { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 240 },

  card:               { borderRadius: 14, borderWidth: 1.5, overflow: "hidden", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  cardStripe:         { height: 3 },
  cardTop:            { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14, paddingBottom: 10 },
  cardLeft:           { flex: 1, gap: 4, paddingRight: 8 },
  cardTopRight:       { alignItems: "flex-end", gap: 0 },
  titleRow:           { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  estimateNum:        { fontSize: 16, fontFamily: "Inter_700Bold" },
  delayPill:          { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fff7ed", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: "#fed7aa" },
  delayPillText:      { fontSize: 10, fontFamily: "Inter_700Bold", color: "#f97316" },
  vehicle:            { fontSize: 13, fontFamily: "Inter_400Regular" },
  metaRow:            { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  metaText:           { fontSize: 11, fontFamily: "Inter_400Regular" },
  metaDot:            { fontSize: 11 },

  stageRow:           { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1 },
  stageDot:           { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stageName:          { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  stageDelayText:     { fontSize: 11, fontFamily: "Inter_700Bold", color: "#f97316" },
  stageOkText:        { fontSize: 11, fontFamily: "Inter_400Regular" },

  progressSection:    { paddingHorizontal: 14, paddingBottom: 12 },

  cardFooter:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, paddingLeft: 14, borderTopWidth: 1 },
  techSection:        { flex: 1 },
  techRow:            { flexDirection: "row", alignItems: "center", gap: 8 },
  techAvatar:         { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  techAvatarText:     { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  techName:           { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  techRoleText:       { fontSize: 11, fontFamily: "Inter_400Regular" },
  unassignedRow:      { flexDirection: "row", alignItems: "center", gap: 5 },
  unassigned:         { fontSize: 13, fontFamily: "Inter_500Medium" },
  cardActions:        { flexDirection: "row", alignItems: "center", gap: 8 },
  holdBtn:            { width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  assignBtn:          { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  assignBtnText:      { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  modalOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%", paddingBottom: 40 },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle:         { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 },
  techOption:         { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  techOptionInfo:     { flex: 1, gap: 4 },
  miniLoadTrack:      { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 2 },
  miniLoadFill:       { height: "100%", borderRadius: 2 },
  statusDot:          { width: 10, height: 10, borderRadius: 5 },
});
