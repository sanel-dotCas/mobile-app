import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill } from "@/components/StatusPill";
import type { Job, JobStatus, LaborType, Technician } from "@/context/JobsContext";
import { useJobs } from "@/context/JobsContext";
import { useStages } from "@/context/StagesContext";
import { useColors } from "@/hooks/useColors";

interface NewJobForm {
  estimateNumber: string;
  licensePlate: string;
  vehicle: string;
  serviceAdvisor: string;
  customerNotes: string;
  appointmentDate: string;
  totalEstimatedHours: string;
  odometer: string;
}

const EMPTY_FORM: NewJobForm = {
  estimateNumber: "",
  licensePlate: "",
  vehicle: "",
  serviceAdvisor: "",
  customerNotes: "",
  appointmentDate: new Date().toISOString().slice(0, 10),
  totalEstimatedHours: "1.0",
  odometer: "0",
};

type FilterKey = "all" | "pending" | "in_progress" | "on_hold" | "completed";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all",         label: "All"         },
  { key: "pending",     label: "New"         },
  { key: "in_progress", label: "In Progress" },
  { key: "on_hold",     label: "On Hold"     },
  { key: "completed",   label: "Done"        },
];

interface SmartScore {
  score: number;
  reasons: string[];
}

function computeSmartScore(tech: Technician, job: Job): SmartScore {
  if (tech.status === "absent") return { score: 0, reasons: ["Not on shift today"] };

  let score = 0;
  const reasons: string[] = [];

  if (tech.status === "active") { score += 28; reasons.push("Active on the floor"); }
  else if (tech.status === "idle") { score += 25; reasons.push("Available — ready to start"); }
  else if (tech.status === "break") { score += 10; reasons.push("Currently on break"); }

  const loadPct = Math.min(tech.totalHoursToday / 8, 1);
  score += Math.round((1 - loadPct) * 30);
  const hoursLeft = Math.max(0, 8 - tech.totalHoursToday).toFixed(1);
  if (loadPct < 0.4) reasons.push(`Light workload — ${hoursLeft}h available today`);
  else if (loadPct < 0.75) reasons.push(`${tech.totalHoursToday}h worked · ${hoursLeft}h remaining`);
  else reasons.push(`Heavy load (${tech.totalHoursToday}h / 8h today)`);

  score += Math.round((tech.efficiency / 100) * 22);
  if (tech.efficiency >= 85) reasons.push(`Excellent efficiency: ${tech.efficiency}%`);
  else if (tech.efficiency >= 70) reasons.push(`Efficiency: ${tech.efficiency}%`);

  const jobLabors: LaborType[] = [...new Set(job.tasks.map((t) => t.laborType))];
  const matched = jobLabors.filter((lt) => (tech.specializations ?? []).includes(lt));
  if (matched.length > 0) {
    score += Math.round((matched.length / Math.max(jobLabors.length, 1)) * 20);
    reasons.push(`Specialises in: ${matched.join(", ")}`);
  }

  if (tech.completedJobs >= 200) {
    score += 5;
    reasons.push(`${tech.completedJobs} completed jobs`);
  }

  return { score: Math.min(100, score), reasons };
}

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
  const { state, assignJob, holdJob, unholdJob, createJob, deleteJob } = useJobs();
  const { getStage } = useStages();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [assignModal, setAssignModal] = useState<{ jobId: string } | null>(null);
  const [smartSuggestion, setSmartSuggestion] = useState<{ tech: Technician; score: number; reasons: string[] } | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState<NewJobForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setSmartSuggestion(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSmartSuggest = (jobId: string) => {
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const available = state.technicians.filter((t) => t.status !== "absent");
    if (available.length === 0) return;
    const scored = available.map((t) => ({ tech: t, ...computeSmartScore(t, job) }));
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    setSmartSuggestion(best);
    Haptics.selectionAsync();
  };

  const handleAutoAssign = (jobId: string) => {
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const available = state.technicians.filter((t) => t.status !== "absent");
    if (available.length === 0) { return; }
    const best = available.reduce((a, b) => {
      return computeSmartScore(b, job).score > computeSmartScore(a, job).score ? b : a;
    });
    handleAssign(jobId, best.id);
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

  const handleCreateJob = async () => {
    setFormError(null);
    if (!form.estimateNumber.trim()) {
      setFormError("Estimate number is required.");
      return;
    }
    if (!form.vehicle.trim()) {
      setFormError("Vehicle is required (e.g. 2022 Ford F-150).");
      return;
    }
    setCreating(true);
    try {
      await createJob({
        estimateNumber: form.estimateNumber.trim(),
        licensePlate: form.licensePlate.trim(),
        vehicle: form.vehicle.trim(),
        serviceAdvisor: form.serviceAdvisor.trim(),
        customerNotes: form.customerNotes.trim(),
        appointmentDate: form.appointmentDate || new Date().toISOString(),
        totalEstimatedHours: parseFloat(form.totalEstimatedHours) || 0,
        odometer: parseInt(form.odometer, 10) || 0,
      });
      setCreateModal(false);
      setForm(EMPTY_FORM);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to create job.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteJob = (job: Job) => {
    Alert.alert(
      "Delete Job",
      `Permanently delete ${job.estimateNumber} — ${job.vehicle}?\n\nThis cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteJob(job.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Error", "Failed to delete job. Please try again.");
            }
          },
        },
      ],
    );
  };

  const FILTER_COLORS: Partial<Record<FilterKey, string>> = {
    on_hold: "#d97706",
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Job Management"
        subtitle={`${state.jobs.length} total jobs`}
        rightElement={
          <Pressable
            onPress={() => { setCreateModal(true); setFormError(null); setForm(EMPTY_FORM); }}
            style={[styles.newJobBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newJobBtnText}>New Job</Text>
          </Pressable>
        }
      />

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
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); handleDeleteJob(job); }}
                      style={[styles.holdBtn, { borderColor: "#fecaca", backgroundColor: "#fff5f5" }]}
                    >
                      <Feather name="trash-2" size={13} color="#ef4444" />
                    </Pressable>
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

      {/* Create Job Modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.modalOverlay} onPress={() => setCreateModal(false)}>
            <Pressable style={[styles.modalSheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation?.()}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Job</Text>
                <Text style={[styles.modalJobLabel, { color: colors.mutedForeground }]}>Create a new repair order</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: "80%" }}>
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Estimate Number *</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    value={form.estimateNumber}
                    onChangeText={(v) => setForm((f) => ({ ...f, estimateNumber: v }))}
                    placeholder="#00001"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Vehicle *</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    value={form.vehicle}
                    onChangeText={(v) => setForm((f) => ({ ...f, vehicle: v }))}
                    placeholder="2022 Ford F-150"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>License Plate</Text>
                    <TextInput
                      style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      value={form.licensePlate}
                      onChangeText={(v) => setForm((f) => ({ ...f, licensePlate: v }))}
                      placeholder="ABC123"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Odometer</Text>
                    <TextInput
                      style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      value={form.odometer}
                      onChangeText={(v) => setForm((f) => ({ ...f, odometer: v }))}
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Service Advisor</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    value={form.serviceAdvisor}
                    onChangeText={(v) => setForm((f) => ({ ...f, serviceAdvisor: v }))}
                    placeholder="Advisor name"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Est. Hours</Text>
                    <TextInput
                      style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      value={form.totalEstimatedHours}
                      onChangeText={(v) => setForm((f) => ({ ...f, totalEstimatedHours: v }))}
                      placeholder="1.0"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Appointment Date</Text>
                    <TextInput
                      style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      value={form.appointmentDate}
                      onChangeText={(v) => setForm((f) => ({ ...f, appointmentDate: v }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Customer Notes</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldTextarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    value={form.customerNotes}
                    onChangeText={(v) => setForm((f) => ({ ...f, customerNotes: v }))}
                    placeholder="Customer concerns, requests..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={3}
                  />
                </View>
                {formError && (
                  <View style={styles.formError}>
                    <Feather name="alert-circle" size={13} color="#ef4444" />
                    <Text style={styles.formErrorText}>{formError}</Text>
                  </View>
                )}
                <Pressable
                  onPress={handleCreateJob}
                  disabled={creating}
                  style={[styles.createBtn, { backgroundColor: creating ? colors.muted : colors.primary }]}
                >
                  {creating
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Feather name="plus-circle" size={16} color="#fff" /><Text style={styles.createBtnText}>Create Job</Text></>
                  }
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign technician modal */}
      {assignModal && (() => {
        const modalJob = state.jobs.find((j) => j.id === assignModal.jobId);
        const available = state.technicians.filter((t) => t.status !== "absent");
        const scoredTechs = modalJob
          ? available.map((t) => ({ tech: t, ...computeSmartScore(t, modalJob) })).sort((a, b) => b.score - a.score)
          : available.map((t) => ({ tech: t, score: 0, reasons: [] as string[] }));

        return (
          <Modal visible transparent animationType="slide" onRequestClose={() => { setAssignModal(null); setSmartSuggestion(null); }}>
            <Pressable style={styles.modalOverlay} onPress={() => { setAssignModal(null); setSmartSuggestion(null); }}>
              <Pressable style={[styles.modalSheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation?.()}>
                <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Assign Technician</Text>
                  {modalJob && (
                    <Text style={[styles.modalJobLabel, { color: colors.mutedForeground }]}>
                      {modalJob.estimateNumber} · {modalJob.vehicle}
                    </Text>
                  )}
                </View>

                {/* AI Action buttons */}
                <View style={styles.aiActionRow}>
                  <Pressable
                    onPress={() => handleAutoAssign(assignModal.jobId)}
                    style={[styles.aiBtn, styles.aiBtnAuto]}
                  >
                    <Feather name="zap" size={13} color="#fff" />
                    <Text style={styles.aiBtnText}>Auto-Assign</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleSmartSuggest(assignModal.jobId)}
                    style={[styles.aiBtn, styles.aiBtnSuggest, { borderColor: colors.primary }]}
                  >
                    <Feather name="cpu" size={13} color={colors.primary} />
                    <Text style={[styles.aiBtnSuggestText, { color: colors.primary }]}>Smart Suggest</Text>
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: "75%" }}>
                  {/* Smart suggestion card */}
                  {smartSuggestion && (
                    <View style={[styles.suggestionCard, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                      <View style={styles.suggestionHeader}>
                        <View style={styles.suggestionBadge}>
                          <Feather name="cpu" size={10} color="#1d4ed8" />
                          <Text style={styles.suggestionBadgeText}>Smart Recommendation</Text>
                        </View>
                        <View style={styles.scoreChip}>
                          <Text style={styles.scoreChipText}>{smartSuggestion.score}/100</Text>
                        </View>
                      </View>
                      <View style={styles.suggestionBody}>
                        <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                          <Text style={styles.techAvatarText}>{smartSuggestion.tech.avatar}</Text>
                        </View>
                        <View style={styles.suggestionInfo}>
                          <Text style={[styles.techName, { color: "#1e3a8a" }]}>{smartSuggestion.tech.name}</Text>
                          <Text style={[styles.techRoleText, { color: "#3b82f6" }]}>{smartSuggestion.tech.role}</Text>
                          {smartSuggestion.reasons.map((r, i) => (
                            <View key={i} style={styles.reasonRow}>
                              <Feather name="check-circle" size={10} color="#16a34a" />
                              <Text style={styles.reasonText}>{r}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      {/* Score bar */}
                      <View style={[styles.miniLoadTrack, { backgroundColor: "#bfdbfe", marginTop: 10 }]}>
                        <View style={[styles.miniLoadFill, { width: `${smartSuggestion.score}%` as `${number}%`, backgroundColor: "#1d4ed8" }]} />
                      </View>
                      <Pressable
                        onPress={() => handleAssign(assignModal.jobId, smartSuggestion.tech.id)}
                        style={styles.confirmSuggestBtn}
                      >
                        <Feather name="user-check" size={13} color="#fff" />
                        <Text style={styles.confirmSuggestText}>Confirm — Assign {smartSuggestion.tech.name.split(" ")[0]}</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Tech list with scores */}
                  <Text style={[styles.listSectionLabel, { color: colors.mutedForeground }]}>
                    {smartSuggestion ? "All Technicians (ranked)" : "Select Technician"}
                  </Text>
                  {scoredTechs.map(({ tech, score }) => {
                    const loadPct = (tech.totalHoursToday / 8) * 100;
                    const loadColor = loadPct >= 90 ? "#ef4444" : loadPct >= 70 ? "#d97706" : "#16a34a";
                    const isSuggested = smartSuggestion?.tech.id === tech.id;
                    return (
                      <Pressable
                        key={tech.id}
                        onPress={() => handleAssign(assignModal.jobId, tech.id)}
                        style={({ pressed }) => [
                          styles.techOption,
                          { borderBottomColor: colors.border, opacity: pressed ? 0.8 : 1 },
                          isSuggested && { backgroundColor: "#eff6ff" },
                        ]}
                      >
                        <View style={[styles.techAvatar, { backgroundColor: isSuggested ? "#1d4ed8" : colors.primary }]}>
                          <Text style={styles.techAvatarText}>{tech.avatar}</Text>
                        </View>
                        <View style={styles.techOptionInfo}>
                          <View style={styles.techNameRow}>
                            <Text style={[styles.techName, { color: colors.foreground }]}>{tech.name}</Text>
                            {isSuggested && (
                              <View style={styles.bestBadge}>
                                <Text style={styles.bestBadgeText}>Best Match</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.techRoleText, { color: colors.mutedForeground }]}>
                            {tech.role} · {tech.efficiency}% eff · {tech.totalHoursToday}h today
                          </Text>
                          <View style={[styles.miniLoadTrack, { backgroundColor: colors.secondary, marginTop: 4 }]}>
                            <View style={[styles.miniLoadFill, { width: `${Math.min(loadPct, 100)}%` as `${number}%`, backgroundColor: loadColor }]} />
                          </View>
                          {smartSuggestion && (
                            <View style={styles.scoreBarRow}>
                              <View style={[styles.scoreTrack, { backgroundColor: colors.border }]}>
                                <View style={[styles.scoreBar, { width: `${score}%` as `${number}%`, backgroundColor: score >= 70 ? "#16a34a" : score >= 45 ? "#d97706" : "#94a3b8" }]} />
                              </View>
                              <Text style={[styles.scorePct, { color: colors.mutedForeground }]}>{score}</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.statusDot, {
                          backgroundColor: tech.status === "active" ? "#16a34a" : tech.status === "idle" ? "#64748b" : "#d97706",
                        }]} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        );
      })()}
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
  modalSheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  modalHeader:        { marginBottom: 14 },
  modalTitle:         { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalJobLabel:      { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  aiActionRow:        { flexDirection: "row", gap: 10, marginBottom: 16 },
  aiBtn:              { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  aiBtnAuto:          { backgroundColor: "#1d4ed8" },
  aiBtnSuggest:       { backgroundColor: "transparent", borderWidth: 1.5 },
  aiBtnText:          { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  aiBtnSuggestText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  suggestionCard:     { borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 16 },
  suggestionHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  suggestionBadge:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#dbeafe", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  suggestionBadgeText:{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#1d4ed8" },
  scoreChip:          { backgroundColor: "#1d4ed8", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  scoreChipText:      { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  suggestionBody:     { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  suggestionInfo:     { flex: 1, gap: 4 },
  reasonRow:          { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  reasonText:         { fontSize: 11, fontFamily: "Inter_400Regular", color: "#374151", flex: 1 },
  confirmSuggestBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 12, backgroundColor: "#1d4ed8", borderRadius: 10, paddingVertical: 10 },
  confirmSuggestText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  listSectionLabel:   { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, marginTop: 4 },
  techNameRow:        { flexDirection: "row", alignItems: "center", gap: 6 },
  bestBadge:          { backgroundColor: "#dbeafe", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  bestBadgeText:      { fontSize: 9, fontFamily: "Inter_700Bold", color: "#1d4ed8" },
  scoreBarRow:        { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  scoreTrack:         { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  scoreBar:           { height: "100%", borderRadius: 2 },
  scorePct:           { fontSize: 10, fontFamily: "Inter_700Bold", minWidth: 22, textAlign: "right" },

  techOption:         { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, paddingHorizontal: 2 },
  techOptionInfo:     { flex: 1, gap: 3 },
  miniLoadTrack:      { height: 4, borderRadius: 2, overflow: "hidden" },
  miniLoadFill:       { height: "100%", borderRadius: 2 },
  statusDot:          { width: 10, height: 10, borderRadius: 5 },

  newJobBtn:          { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  newJobBtnText:      { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  formGroup:          { gap: 5, marginBottom: 12 },
  formRow:            { flexDirection: "row", gap: 10 },
  fieldLabel:         { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  fieldInput:         { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  fieldTextarea:      { minHeight: 72, textAlignVertical: "top", paddingTop: 10 },
  formError:          { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#fff5f5", borderRadius: 8, padding: 10, marginBottom: 12 },
  formErrorText:      { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#ef4444" },
  createBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4, marginBottom: 8 },
  createBtnText:      { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
