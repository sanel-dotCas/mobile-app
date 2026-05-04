import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
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
import { ClockInModal } from "@/components/ClockInModal";
import { InspectionChecklist } from "@/components/InspectionChecklist";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill } from "@/components/StatusPill";
import { TaskCard } from "@/components/TaskCard";
import { useAuth } from "@/context/AuthContext";
import type { NoteAttachment, Part, PartStatus } from "@/context/JobsContext";
import { useJobs } from "@/context/JobsContext";
import { useLang } from "@/context/LanguageContext";
import { useStages } from "@/context/StagesContext";
import { useColors } from "@/hooks/useColors";

type TabKey = "tasks" | "parts" | "inspections" | "notes";

function MetaItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={metaStyles.item}>
      <View style={[metaStyles.iconCircle, { backgroundColor: colors.accent }]}>
        <Feather name={icon as any} size={14} color={colors.primary} />
      </View>
      <View style={metaStyles.textBlock}>
        <Text style={[metaStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[metaStyles.value, { color: colors.foreground }]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const metaStyles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "flex-start", gap: 8, width: "48%", marginBottom: 12 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  textBlock: { flex: 1 },
  label: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 1 },
  value: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});


function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, getJob, clockIn, clockOut, addNote, markJobComplete, advanceStage, receivePart, updatePartStatus, updateOdometer, pendingOdometerUpdates } = useJobs();
  const { sortedStages, getStage } = useStages();
  const { role } = useAuth();
  const { t } = useLang();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [noteText, setNoteText] = useState("");
  const [noteSubject, setNoteSubject] = useState("");
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [attachLabel, setAttachLabel] = useState("");
  const [clockInModal, setClockInModal] = useState<{ jobId: string; taskId: string; taskTitle: string } | null>(null);
  const [mileageModalVisible, setMileageModalVisible] = useState(false);
  const [mileageInput, setMileageInput] = useState("");

  const job = getJob(id ?? "");

  if (!job) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Job Not Found" showBack />
        <View style={styles.notFound}>
          <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
          <Text style={[styles.notFoundText, { color: colors.foreground }]}>Job not found</Text>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const activeClockedTask = job.tasks.find((t) => t.clockedIn);

  // Stage data
  const currentStage = getStage(job.currentStageId);
  const currentStageIdx = sortedStages.findIndex((s) => s.id === job.currentStageId);
  const nextStage = currentStageIdx < sortedStages.length - 1 ? sortedStages[currentStageIdx + 1] : null;

  const isStageCompleted = (stageId: string) => {
    const history = job.stageHistory ?? [];
    const idx = history.findIndex((e) => e.stageId === stageId);
    if (idx < 0) return false;
    return history.some((e, i) => i > idx);
  };

  const stageCurrentEntry = (job.stageHistory ?? []).slice().reverse().find((e) => e.stageId === job.currentStageId);
  const hoursInCurrentStage = stageCurrentEntry
    ? (Date.now() - new Date(stageCurrentEntry.enteredAt).getTime()) / 3600000
    : 0;
  const isStageDelayed = currentStage ? hoursInCurrentStage > currentStage.expectedHours : false;
  const overdueHours = currentStage ? Math.max(0, hoursInCurrentStage - currentStage.expectedHours) : 0;
  const allTasksDone = job.tasks.length > 0 && job.tasks.every((task) => task.status === "done");

  const handleAdvanceStage = () => {
    if (!nextStage) return;
    Alert.alert(
      "Advance Stage",
      `Move this job from "${currentStage?.name ?? "current stage"}" to "${nextStage.name}"?\n\nThis will notify the supervisor and technician.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Advance",
          onPress: () => {
            advanceStage(job.id, nextStage.id, nextStage.name);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleClockIn = (taskId: string, taskTitle: string) => {
    const { activeClockIn } = state;
    const isAlreadyClockedInHere = activeClockIn?.jobId === job.id && activeClockIn?.taskId === taskId;

    if (activeClockIn && !isAlreadyClockedInHere) {
      let activeTaskName = "another task";
      const activeJob = state.jobs.find((j) => j.id === activeClockIn.jobId);
      if (activeJob) {
        const activeTask = activeJob.tasks.find((t) => t.id === activeClockIn.taskId);
        if (activeTask) activeTaskName = activeTask.title;
      }

      Alert.alert(
        "Already Clocked In",
        `You're already clocked in to "${activeTaskName}". Clock out first, or switch tasks?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Switch Tasks",
            onPress: () => {
              clockOut(activeClockIn.jobId, activeClockIn.taskId);
              clockIn(job.id, taskId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
      return;
    }

    setClockInModal({ jobId: job.id, taskId, taskTitle });
  };

  const confirmClockIn = () => {
    if (!clockInModal) return;
    clockIn(clockInModal.jobId, clockInModal.taskId);
    setClockInModal(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleClockOut = (taskId: string) => {
    clockOut(job.id, taskId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Please allow photo library access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setAttachments((prev) => [...prev, { uri: result.assets[0].uri, label: attachLabel || "Photo", type: "image" }]);
      setAttachLabel("");
    }
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Please allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setAttachments((prev) => [...prev, { uri: result.assets[0].uri, label: attachLabel || "Camera", type: "image" }]);
      setAttachLabel("");
    }
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(job.id, noteText.trim(), noteSubject.trim() || undefined, attachments.length > 0 ? attachments : undefined);
    setNoteText(""); setNoteSubject(""); setAttachments([]); setAttachLabel("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleOpenMileageModal = () => {
    setMileageInput(String(job.odometer));
    setMileageModalVisible(true);
  };

  const handleConfirmMileage = () => {
    const parsed = parseInt(mileageInput.replace(/\D/g, ""), 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setMileageModalVisible(false);
      updateOdometer(job.id, parsed)
        .then(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });
    } else {
      setMileageModalVisible(false);
    }
  };

  const odometerPending = pendingOdometerUpdates.some((u) => u.jobId === job.id);

  const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: "tasks", label: "Tasks", icon: "tool" },
    { key: "parts", label: "Parts", icon: "package" },
    { key: "inspections", label: "Inspect", icon: "clipboard" },
    { key: "notes", label: "Notes", icon: "message-square" },
  ];

  const totalParts = job.tasks.reduce((s, t) => s + (t.parts ?? []).length, 0);
  const pendingParts = job.tasks.reduce((s, t) => s + (t.parts ?? []).filter((p) => p.status !== "received").length, 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`Estimate ${job.estimateNumber}`}
        subtitle={job.vehicle}
        showBack
        rightElement={
          <View style={styles.headerActions}>
            {pendingParts > 0 && (
              <View style={[styles.partsChip, { backgroundColor: "#fef3c7" }]}>
                <Feather name="package" size={11} color="#d97706" />
                <Text style={styles.partsChipText}>{pendingParts}</Text>
              </View>
            )}
            {role === "supervisor" && (
              <Pressable
                onPress={() => Alert.alert("Mark Complete", "Mark this job as fully complete?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Complete", onPress: () => { markJobComplete(job.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
                ])}
                style={[styles.headerBtn, { borderColor: colors.success }]}
              >
                <Text style={[styles.headerBtnText, { color: colors.success }]}>Complete</Text>
              </Pressable>
            )}
          </View>
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 90 }]} showsVerticalScrollIndicator={false}>

        {/* Metadata */}
        <View style={[styles.metaCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <View style={styles.metaGrid}>
            <MetaItem icon="hash" label="License Plate" value={job.licensePlate} />
            <MetaItem icon="truck" label="Vehicle" value={job.vehicle} />
            <MetaItem icon="user" label="Service Advisor" value={job.serviceAdvisor} />
            <MetaItem icon="clock" label="Est. Hours" value={`${job.totalEstimatedHours}h`} />
            <View style={metaStyles.item}>
              <View style={[metaStyles.iconCircle, { backgroundColor: colors.accent }]}>
                <Feather name="activity" size={14} color={colors.primary} />
              </View>
              <View style={metaStyles.textBlock}>
                <View style={styles.odometerLabelRow}>
                  <Text style={[metaStyles.label, { color: colors.mutedForeground }]}>Odometer</Text>
                  {odometerPending && (
                    <View style={styles.pendingSyncBadge}>
                      <Feather name="clock" size={9} color="#d97706" />
                      <Text style={styles.pendingSyncText}>Pending Sync</Text>
                    </View>
                  )}
                </View>
                <View style={styles.odometerRow}>
                  <Text style={[metaStyles.value, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>{job.odometer.toLocaleString()} km</Text>
                  <Pressable onPress={handleOpenMileageModal} style={[styles.takeActionBtn, { borderColor: colors.primary }]}>
                    <Text style={[styles.takeActionBtnText, { color: colors.primary }]}>Take Action</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <MetaItem icon="file-text" label="Customer Notes" value={job.customerNotes || "None"} />
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metaFooter}>
            <View style={styles.metaStatusRow}>
              <StatusPill status={job.status} size="md" />
              <Text style={[styles.metaAppt, { color: colors.mutedForeground }]}>
                <Feather name="calendar" size={11} /> {new Date(job.appointmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            <ProgressBar progress={job.progress} showLabel height={7} />
          </View>
        </View>

        {/* ── Stage Progress Stepper ── */}
        {job.status !== "completed" && sortedStages.length > 0 && (
          <View style={[styles.stageCard, {
            backgroundColor: colors.card,
            borderColor: isStageDelayed ? "#f97316" : currentStage ? currentStage.color + "30" : colors.border,
            shadowColor: "#000",
          }]}>
            {/* Header row */}
            <View style={styles.stageHeader}>
              <View style={styles.stageHeaderLeft}>
                {currentStage && (
                  <View style={[styles.stageIconBadge, { backgroundColor: currentStage.color }]}>
                    <Feather name={currentStage.icon as any} size={14} color="#fff" />
                  </View>
                )}
                <View>
                  <Text style={[styles.stageTitle, { color: colors.foreground }]}>
                    {currentStage?.name ?? "Unknown Stage"}
                  </Text>
                  <Text style={[styles.stageSubtitle, { color: isStageDelayed ? "#f97316" : colors.mutedForeground }]}>
                    {isStageDelayed
                      ? `${overdueHours.toFixed(1)}h overdue — action needed`
                      : `${hoursInCurrentStage.toFixed(1)}h / ${currentStage?.expectedHours ?? 0}h expected`}
                  </Text>
                </View>
              </View>
              {isStageDelayed && (
                <View style={styles.delayBadge}>
                  <Feather name="alert-triangle" size={12} color="#f97316" />
                  <Text style={styles.delayBadgeText}>Delayed</Text>
                </View>
              )}
            </View>

            {/* Stepper */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepperScroll}>
              <View style={styles.stepper}>
                {sortedStages.map((stage, i) => {
                  const isCurrent = stage.id === job.currentStageId;
                  const isDone = isStageCompleted(stage.id);
                  const isUpcoming = !isCurrent && !isDone;
                  return (
                    <React.Fragment key={stage.id}>
                      <View style={styles.stepperItem}>
                        <View style={[
                          styles.stepDot,
                          {
                            backgroundColor: isDone ? stage.color : isCurrent ? stage.color : colors.border,
                            borderColor: isCurrent ? stage.color : "transparent",
                            borderWidth: isCurrent ? 3 : 0,
                          },
                        ]}>
                          {isDone
                            ? <Feather name="check" size={10} color="#fff" />
                            : isCurrent
                              ? <Feather name={stage.icon as any} size={10} color="#fff" />
                              : <View style={[styles.stepDotInner, { backgroundColor: colors.mutedForeground + "50" }]} />
                          }
                        </View>
                        <Text
                          style={[
                            styles.stepLabel,
                            {
                              color: isDone ? stage.color : isCurrent ? stage.color : colors.mutedForeground,
                              fontFamily: isCurrent ? "Inter_700Bold" : "Inter_400Regular",
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {stage.name}
                        </Text>
                        {isCurrent && (
                          <View style={[styles.stepCurrent, { backgroundColor: stage.color + "20" }]}>
                            <Text style={[styles.stepCurrentText, { color: stage.color }]}>Now</Text>
                          </View>
                        )}
                      </View>
                      {i < sortedStages.length - 1 && (
                        <View style={[
                          styles.stepConnector,
                          { backgroundColor: isDone ? sortedStages[i].color : colors.border },
                        ]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </ScrollView>

            {/* ── TECHNICIAN view ── */}
            {role !== "supervisor" && (
              <>
                {/* At a non-QC stage: show Submit for QC button only when all tasks done */}
                {!currentStage?.isManual && nextStage && allTasksDone && (
                  <Pressable
                    onPress={handleAdvanceStage}
                    style={[styles.advanceBtn, { backgroundColor: "#7c3aed" }]}
                  >
                    <Feather name="send" size={14} color="#fff" />
                    <Text style={styles.advanceBtnText}>{t.submitForQC}</Text>
                    <Feather name="arrow-right" size={14} color="#fff" />
                  </Pressable>
                )}

                {/* At a non-QC stage with tasks still pending: info only */}
                {!currentStage?.isManual && nextStage && !allTasksDone && (
                  <View style={[styles.autoAdvanceBanner, { backgroundColor: "#f0fdf4", borderColor: "#86efac" }]}>
                    <Feather name="clock" size={13} color="#16a34a" />
                    <Text style={[styles.autoAdvanceBannerText, { color: "#166534" }]}>
                      Complete all tasks to submit for QC
                    </Text>
                  </View>
                )}

                {/* At the QC stage: awaiting supervisor banner */}
                {currentStage?.isManual && (
                  <View style={[styles.qcBanner, { backgroundColor: "#f5f3ff", borderColor: "#c4b5fd" }]}>
                    <View style={[styles.qcIconWrap, { backgroundColor: "#7c3aed" }]}>
                      <Feather name="shield" size={13} color="#fff" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.qcBannerTitle}>{t.qcRequired}</Text>
                      <Text style={styles.qcBannerSub}>{t.qcManual}</Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ── SUPERVISOR view ── */}
            {role === "supervisor" && nextStage && (
              <>
                {/* At QC stage: Pass QC button */}
                {currentStage?.isManual ? (
                  <Pressable
                    onPress={handleAdvanceStage}
                    style={[styles.advanceBtn, { backgroundColor: "#7c3aed" }]}
                  >
                    <Feather name="check-square" size={14} color="#fff" />
                    <Text style={styles.advanceBtnText}>{t.qcCheck} — {t.moveTo} {nextStage.name}</Text>
                    <Feather name="arrow-right" size={14} color="#fff" />
                  </Pressable>
                ) : (
                  /* At any other stage: normal advance */
                  <Pressable
                    onPress={handleAdvanceStage}
                    style={[styles.advanceBtn, { backgroundColor: nextStage.color }]}
                  >
                    <Feather name={nextStage.icon as any} size={14} color="#fff" />
                    <Text style={styles.advanceBtnText}>{t.moveTo} {nextStage.name}</Text>
                    <Feather name="arrow-right" size={14} color="#fff" />
                  </Pressable>
                )}
              </>
            )}

            {!nextStage && (
              <View style={[styles.finalStageNote, { backgroundColor: "#dcfce7", borderColor: "#86efac" }]}>
                <Feather name="check-circle" size={14} color="#16a34a" />
                <Text style={[styles.finalStageNoteText, { color: "#166534" }]}>{t.stageComplete}</Text>
              </View>
            )}
          </View>
        )}

        {/* Completed stage summary */}
        {job.status === "completed" && (
          <View style={[styles.completedStageCard, { backgroundColor: "#dcfce7", borderColor: "#86efac" }]}>
            <Feather name="check-circle" size={16} color="#16a34a" />
            <Text style={[styles.completedStageText, { color: "#166534" }]}>
              Job completed — passed through {job.stageHistory.length} stage{job.stageHistory.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {/* Parts summary banner */}
        {totalParts > 0 && (
          <Pressable
            onPress={() => setActiveTab("parts")}
            style={[styles.partsBanner, { backgroundColor: pendingParts > 0 ? "#fef3c7" : "#dcfce7", borderColor: pendingParts > 0 ? "#fbbf24" : "#86efac" }]}
          >
            <Feather name="package" size={14} color={pendingParts > 0 ? "#d97706" : "#16a34a"} />
            <Text style={[styles.partsBannerText, { color: pendingParts > 0 ? "#92400e" : "#166534" }]}>
              {pendingParts > 0
                ? `${pendingParts} of ${totalParts} parts pending receipt`
                : `All ${totalParts} parts received ✓`}
            </Text>
            {pendingParts > 0 && <Feather name="chevron-right" size={13} color="#d97706" />}
          </Pressable>
        )}

        {/* Active clock-in banner */}
        {activeClockedTask && (
          <View style={[styles.activeTimerBanner, { backgroundColor: colors.primary }]}>
            <View style={styles.timerBannerLeft}>
              <View style={styles.timerPulse}>
                <View style={[styles.timerDot, { backgroundColor: "#fff" }]} />
              </View>
              <View>
                <Text style={styles.timerBannerTitle}>Active: {activeClockedTask.title}</Text>
                <Text style={styles.timerBannerTime}>{formatElapsed(activeClockedTask.elapsedSeconds)}</Text>
              </View>
            </View>
            <Pressable onPress={() => handleClockOut(activeClockedTask.id)} style={styles.stopTimerBtn}>
              <Feather name="square" size={14} color={colors.primary} />
              <Text style={[styles.stopTimerBtnText, { color: colors.primary }]}>Stop</Text>
            </Pressable>
          </View>
        )}

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TABS.map(({ key, label, icon }) => (
            <Pressable
              key={key}
              onPress={() => { setActiveTab(key); Haptics.selectionAsync(); }}
              style={[styles.tabItem, activeTab === key && [styles.tabItemActive, { borderBottomColor: colors.primary }]]}
            >
              <Text style={[styles.tabLabel, { color: activeTab === key ? colors.primary : colors.mutedForeground }]}>{label}</Text>
              {key === "tasks" && (
                <View style={[styles.tabBadge, { backgroundColor: activeTab === key ? colors.primary : colors.muted }]}>
                  <Text style={[styles.tabBadgeText, { color: activeTab === key ? "#fff" : colors.mutedForeground }]}>{job.tasks.length}</Text>
                </View>
              )}
              {key === "parts" && totalParts > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: pendingParts > 0 ? "#d97706" : (activeTab === key ? colors.primary : colors.muted) }]}>
                  <Text style={[styles.tabBadgeText, { color: pendingParts > 0 ? "#fff" : (activeTab === key ? "#fff" : colors.mutedForeground) }]}>{totalParts}</Text>
                </View>
              )}
              {key === "inspections" && job.inspections.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: activeTab === key ? colors.primary : colors.muted }]}>
                  <Text style={[styles.tabBadgeText, { color: activeTab === key ? "#fff" : colors.mutedForeground }]}>{job.inspections.length}</Text>
                </View>
              )}
              {key === "notes" && job.notes.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: activeTab === key ? colors.primary : colors.muted }]}>
                  <Text style={[styles.tabBadgeText, { color: activeTab === key ? "#fff" : colors.mutedForeground }]}>{job.notes.length}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* ── Tasks Tab ────────────────────────────────────── */}
        {activeTab === "tasks" && (
          <View style={styles.tabContent}>
            <View style={[styles.tasksSummary, { backgroundColor: colors.card, shadowColor: "#000" }]}>
              {[
                { label: "Done", value: `${job.tasks.filter((t) => t.status === "done").length}/${job.tasks.length}` },
                { label: "Worked", value: `${job.workedHours.toFixed(1)}h` },
                { label: "Assigned", value: `${job.totalEstimatedHours}h` },
                { label: "Parts", value: `${job.tasks.reduce((s, t) => s + (t.parts ?? []).filter((p) => p.status === "received").length, 0)}/${totalParts}` },
              ].map(({ label, value }, i, arr) => (
                <React.Fragment key={label}>
                  <View style={styles.taskSummaryItem}>
                    <Text style={[styles.taskSummaryValue, { color: colors.foreground }]}>{value}</Text>
                    <Text style={[styles.taskSummaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[styles.taskSummaryDivider, { backgroundColor: colors.border }]} />}
                </React.Fragment>
              ))}
            </View>
            {job.tasks.map((task) => (
              <TaskCard key={task.id} task={task} jobId={job.id}
                onClockIn={() => handleClockIn(task.id, task.title)}
                onClockOut={() => handleClockOut(task.id)}
                showClockIn={role === "technician"}
              />
            ))}
          </View>
        )}

        {/* ── Parts Tab ────────────────────────────────────── */}
        {activeTab === "parts" && (
          <View style={styles.tabContent}>
            {/* Summary bar */}
            {totalParts > 0 && (
              <View style={[styles.partsSummaryCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
                {[
                  { label: "Total", value: `${totalParts}` },
                  { label: "Received", value: `${totalParts - pendingParts}`, color: "#16a34a" },
                  { label: "Pending", value: `${pendingParts}`, color: pendingParts > 0 ? "#d97706" : colors.mutedForeground },
                  { label: "Cost", value: `$${job.tasks.reduce((s, t) => s + (t.parts ?? []).reduce((ps, p) => ps + (p.price ?? 0) * p.quantity, 0), 0).toFixed(0)}` },
                ].map(({ label, value, color }, i, arr) => (
                  <React.Fragment key={label}>
                    <View style={styles.taskSummaryItem}>
                      <Text style={[styles.taskSummaryValue, { color: color ?? colors.foreground }]}>{value}</Text>
                      <Text style={[styles.taskSummaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={[styles.taskSummaryDivider, { backgroundColor: colors.border }]} />}
                  </React.Fragment>
                ))}
              </View>
            )}
            {/* Per-task grouped parts list */}
            {totalParts === 0 ? (
              <View style={styles.emptyNotes}>
                <Feather name="package" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyNotesText, { color: colors.mutedForeground }]}>No parts on this job</Text>
                <Text style={[styles.emptyNotesText, { color: colors.mutedForeground, fontSize: 12 }]}>Request parts from inside a task card</Text>
              </View>
            ) : (
              job.tasks.filter((t) => (t.parts ?? []).length > 0).map((task) => (
                <View key={task.id} style={[styles.partsGroupCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: "#000" }]}>
                  {/* Task header */}
                  <View style={[styles.partsGroupHeader, { borderBottomColor: colors.border }]}>
                    <View style={[styles.partsGroupIconWrap, { backgroundColor: colors.accent }]}>
                      <Feather name="tool" size={13} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.partsGroupTitle, { color: colors.foreground }]}>{task.title}</Text>
                      <Text style={[styles.partsGroupSub, { color: colors.mutedForeground }]}>
                        {(task.parts ?? []).filter((p) => p.status === "received").length}/{(task.parts ?? []).length} received
                      </Text>
                    </View>
                    <StatusPill status={task.status} size="sm" />
                  </View>
                  {/* Parts list */}
                  {(task.parts ?? []).map((part: Part, pIdx: number) => {
                    const PART_CFG: Record<PartStatus, { label: string; color: string; bg: string; icon: string }> = {
                      pending:  { label: "Pending",  color: "#d97706", bg: "#fef3c7", icon: "clock" },
                      ordered:  { label: "Ordered",  color: "#0284c7", bg: "#e0f2fe", icon: "truck" },
                      received: { label: "Received", color: "#16a34a", bg: "#dcfce7", icon: "check-circle" },
                    };
                    const cfg = PART_CFG[part.status];
                    return (
                      <View key={part.id} style={[styles.partsRowItem, { borderTopColor: colors.border, borderTopWidth: pIdx === 0 ? 0 : 1 }]}>
                        <View style={[styles.partsRowIcon, { backgroundColor: cfg.bg }]}>
                          <Feather name={cfg.icon as any} size={12} color={cfg.color} />
                        </View>
                        <View style={styles.partsRowInfo}>
                          <Text style={[styles.partsRowName, { color: colors.foreground }]} numberOfLines={1}>{part.name}</Text>
                          <View style={styles.partsRowMeta}>
                            {part.partNumber ? <Text style={[styles.partsRowMetaText, { color: colors.mutedForeground }]}>#{part.partNumber}</Text> : null}
                            <Text style={[styles.partsRowMetaText, { color: colors.mutedForeground }]}>×{part.quantity} {part.unit}</Text>
                            {part.price !== undefined && (
                              <Text style={[styles.partsRowMetaText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                                ${(part.price * part.quantity).toFixed(2)}
                              </Text>
                            )}
                          </View>
                          {part.receivedAt && (
                            <Text style={[styles.partsRowReceived, { color: colors.success }]}>
                              Received {new Date(part.receivedAt).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.partsRowActions}>
                          <Pressable
                            onPress={() => {
                              if (part.status === "received") return;
                              const next: PartStatus = part.status === "pending" ? "ordered" : "received";
                              Alert.alert("Update Status", `Move "${part.name}" to ${next}?`, [
                                { text: "Cancel", style: "cancel" },
                                { text: "Update", onPress: () => { if (next === "received") receivePart(job.id, task.id, part.id); else updatePartStatus(job.id, task.id, part.id, next); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } },
                              ]);
                            }}
                            style={[styles.partsStatusPill, { backgroundColor: cfg.bg }]}
                          >
                            <Text style={[styles.partsStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                          </Pressable>
                          {part.status !== "received" && (
                            <Pressable
                              onPress={() => Alert.alert("Receive Part", `Mark "${part.name}" as received?`, [
                                { text: "Cancel", style: "cancel" },
                                { text: "Mark Received", onPress: () => { receivePart(job.id, task.id, part.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
                              ])}
                              style={[styles.partsReceiveBtn, { backgroundColor: colors.success }]}
                            >
                              <Feather name="check" size={11} color="#fff" />
                              <Text style={styles.partsReceiveBtnText}>Receive</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Notes Tab ────────────────────────────────────── */}
        {activeTab === "notes" && (
          <View style={styles.tabContent}>
            <View style={[styles.noteForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.noteFormTitle, { color: colors.foreground }]}>Create Note</Text>
              <TextInput value={noteSubject} onChangeText={setNoteSubject} placeholder="Subject"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.noteSubjectInput, { color: colors.foreground, borderColor: colors.border }]} />
              <TextInput value={noteText} onChangeText={setNoteText} placeholder="Notes"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.noteTextInput, { color: colors.foreground, borderColor: colors.border }]}
                multiline textAlignVertical="top" />
              <View style={styles.attachRow}>
                <Pressable onPress={handleCamera} style={[styles.attachPickerBtn, { borderColor: colors.border }]}>
                  <Feather name="paperclip" size={16} color={colors.mutedForeground} />
                </Pressable>
                <TextInput value={attachLabel} onChangeText={setAttachLabel} placeholder="Attachment"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.attachNameInput, { color: colors.foreground, borderColor: colors.border }]} />
                <TextInput placeholder="Attachment Label"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.attachLabelInput, { color: colors.foreground, borderColor: colors.border }]} />
              </View>
              {attachLabel.length > 0 && (
                <View style={styles.attachOptions}>
                  <Pressable onPress={handleCamera} style={[styles.attachOptionBtn, { borderColor: colors.border }]}>
                    <Feather name="camera" size={14} color={colors.primary} />
                    <Text style={[styles.attachOptionText, { color: colors.primary }]}>Camera</Text>
                  </Pressable>
                  <Pressable onPress={handlePickImage} style={[styles.attachOptionBtn, { borderColor: colors.border }]}>
                    <Feather name="image" size={14} color={colors.primary} />
                    <Text style={[styles.attachOptionText, { color: colors.primary }]}>Gallery</Text>
                  </Pressable>
                </View>
              )}
              {attachments.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachPreviewScroll}>
                  {attachments.map((att, i) => (
                    <View key={i} style={styles.previewWrap}>
                      {att.type === "image"
                        ? <Image source={{ uri: att.uri }} style={styles.previewThumb} />
                        : <View style={[styles.docPreview, { backgroundColor: colors.accent }]}><Feather name="file" size={18} color={colors.primary} /></View>
                      }
                      <Text style={[styles.previewLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{att.label}</Text>
                      <Pressable onPress={() => setAttachments((p) => p.filter((_, j) => j !== i))} style={styles.removeAttach}>
                        <Feather name="x" size={10} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={styles.noteFormActions}>
                <Pressable
                  onPress={() => { setNoteText(""); setNoteSubject(""); setAttachments([]); }}
                  style={[styles.cancelNoteBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.cancelNoteBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleAddNote}
                  style={[styles.saveNoteBtn, { backgroundColor: colors.primary, opacity: noteText.trim() ? 1 : 0.5 }]}
                  disabled={!noteText.trim()}
                >
                  <Text style={styles.saveNoteBtnText}>Save</Text>
                </Pressable>
              </View>
            </View>

            {job.notes.length === 0 ? (
              <View style={styles.emptyNotes}>
                <Feather name="message-square" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyNotesText, { color: colors.mutedForeground }]}>No notes yet</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.historyTitle, { color: colors.mutedForeground }]}>History ({job.notes.length})</Text>
                {[...job.notes].reverse().map((note) => (
                  <View key={note.id} style={[styles.noteItem, { backgroundColor: colors.card, borderLeftColor: colors.primary, shadowColor: "#000" }]}>
                    <View style={styles.noteHeader}>
                      <View style={[styles.noteAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.noteAvatarText}>{note.author.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.noteAuthor, { color: colors.foreground }]}>{note.author}</Text>
                        <Text style={[styles.noteTime, { color: colors.mutedForeground }]}>{new Date(note.timestamp).toLocaleString()}</Text>
                      </View>
                    </View>
                    {note.subject && <Text style={[styles.noteSubject, { color: colors.primary }]}>{note.subject}</Text>}
                    <Text style={[styles.noteBody, { color: colors.foreground }]}>{note.text}</Text>
                    {note.attachments && note.attachments.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        {note.attachments.map((att, i) => (
                          att.type === "image"
                            ? <Image key={i} source={{ uri: att.uri }} style={styles.noteAttachThumb} />
                            : <View key={i} style={[styles.noteDocAttach, { backgroundColor: colors.accent }]}>
                                <Feather name="file" size={14} color={colors.primary} />
                                <Text style={[styles.noteDocLabel, { color: colors.primary }]}>{att.label}</Text>
                              </View>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* ── Inspections Tab ──────────────────────────────── */}
        {activeTab === "inspections" && (
          <View style={styles.tabContent}>
            <InspectionChecklist jobId={job.id} />
          </View>
        )}
      </ScrollView>

      {/* FAB — technician only */}
      {role === "technician" && !activeClockedTask && job.status !== "completed" && (
        <View style={[styles.floatingCta, { bottom: bottomPad + 16 }]}>
          <Pressable
            onPress={() => {
              const pendingTask = job.tasks.find((t) => t.status !== "done");
              if (pendingTask) handleClockIn(pendingTask.id, pendingTask.title);
              else Alert.alert("All tasks complete", "All tasks are done.");
            }}
            style={[styles.clockInFab, { backgroundColor: colors.primary }]}
          >
            <Feather name="clock" size={18} color="#fff" />
            <Text style={styles.clockInFabText}>Clock In</Text>
          </Pressable>
        </View>
      )}

      {clockInModal && (
        <ClockInModal visible={!!clockInModal} job={job} taskTitle={clockInModal.taskTitle}
          onConfirm={confirmClockIn} onCancel={() => setClockInModal(null)} />
      )}

      <Modal
        visible={mileageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMileageModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.mileageOverlay}
        >
          <Pressable style={styles.mileageBackdrop} onPress={() => setMileageModalVisible(false)} />
          <View style={[styles.mileageSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.mileageTitle, { color: colors.foreground }]}>Update Mileage In</Text>
            <Text style={[styles.mileageSubtitle, { color: colors.mutedForeground }]}>Please verify or update the mileage value:</Text>
            <View style={[styles.mileageInputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.mileageInputLabel, { color: colors.primary }]}>Mileage In</Text>
              <TextInput
                style={[styles.mileageInput, { color: colors.foreground }]}
                value={mileageInput}
                onChangeText={(v) => setMileageInput(v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={handleConfirmMileage}
                selectTextOnFocus
              />
            </View>
            <View style={styles.mileageActions}>
              <Pressable
                onPress={() => setMileageModalVisible(false)}
                style={[styles.mileageCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.mileageCancelText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmMileage}
                disabled={mileageInput.trim() === ""}
                style={[styles.mileageConfirmBtn, { backgroundColor: mileageInput.trim() === "" ? colors.mutedForeground : colors.primary }]}
              >
                <Text style={styles.mileageConfirmText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  partsChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10 },
  partsChipText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#d97706" },
  headerBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1.5 },
  headerBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  metaCard: { borderRadius: 14, padding: 16, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  metaDivider: { height: 1, marginVertical: 12 },
  metaFooter: { gap: 10 },
  metaStatusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metaAppt: { fontSize: 12, fontFamily: "Inter_400Regular" },

  stageCard: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 12, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  stageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stageHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  stageIconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stageTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  stageSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  delayBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fff7ed", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  delayBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#f97316" },

  stepperScroll: { marginHorizontal: -4 },
  stepper: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 4, paddingBottom: 4 },
  stepperItem: { alignItems: "center", gap: 6, minWidth: 64, maxWidth: 72 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepDotInner: { width: 10, height: 10, borderRadius: 5 },
  stepLabel: { fontSize: 9, textAlign: "center", lineHeight: 13 },
  stepCurrent: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  stepCurrentText: { fontSize: 8, fontFamily: "Inter_700Bold" },
  stepConnector: { height: 2, width: 20, marginTop: 13, flexShrink: 0 },

  advanceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12 },
  advanceBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  finalStageNote: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  finalStageNoteText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  qcBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  qcIconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  qcBannerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#7c3aed" },
  qcBannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6d28d9", lineHeight: 16 },
  autoAdvanceBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  autoAdvanceBannerText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  completedStageCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  completedStageText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  partsBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  partsBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  activeTimerBanner: { borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timerBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  timerPulse: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  timerDot: { width: 10, height: 10, borderRadius: 5 },
  timerBannerTitle: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  timerBannerTime: { color: "rgba(255,255,255,0.9)", fontSize: 18, fontFamily: "Inter_700Bold" },
  stopTimerBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  stopTimerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBar: { flexDirection: "row", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabItemActive: {},
  tabLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  tabContent: { gap: 0 },
  tasksSummary: { flexDirection: "row", borderRadius: 12, padding: 14, marginBottom: 12, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  taskSummaryItem: { flex: 1, alignItems: "center", gap: 2 },
  taskSummaryDivider: { width: 1, alignSelf: "stretch" },
  taskSummaryValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  taskSummaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },

  noteForm: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10, marginBottom: 14 },
  noteFormTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  noteSubjectInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  noteTextInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 90 },
  attachRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  attachPickerBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  attachNameInput: { flex: 1, height: 40, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, fontFamily: "Inter_400Regular" },
  attachLabelInput: { flex: 1, height: 40, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, fontFamily: "Inter_400Regular" },
  attachOptions: { flexDirection: "row", gap: 8 },
  attachOptionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  attachOptionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  attachPreviewScroll: { marginTop: 4 },
  previewWrap: { marginRight: 10, alignItems: "center", position: "relative" },
  previewThumb: { width: 64, height: 64, borderRadius: 10 },
  docPreview: { width: 64, height: 64, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  previewLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3, maxWidth: 64, textAlign: "center" },
  removeAttach: { position: "absolute", top: -4, right: -4, backgroundColor: "#ef4444", borderRadius: 8, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  noteFormActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelNoteBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 10, borderWidth: 1.5 },
  cancelNoteBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  saveNoteBtn: { flex: 2, alignItems: "center", paddingVertical: 11, borderRadius: 10 },
  saveNoteBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  historyTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  emptyNotes: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyNotesText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  noteItem: { borderRadius: 12, padding: 14, marginBottom: 10, gap: 8, borderLeftWidth: 3, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  noteHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  noteAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  noteAvatarText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  noteAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noteTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  noteSubject: { fontSize: 13, fontFamily: "Inter_700Bold" },
  noteBody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  noteAttachThumb: { width: 72, height: 72, borderRadius: 10, marginRight: 8 },
  noteDocAttach: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, marginRight: 8 },
  noteDocLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  /* Parts Tab */
  partsSummaryCard: { flexDirection: "row", borderRadius: 12, padding: 14, marginBottom: 12, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  partsGroupCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  partsGroupHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1 },
  partsGroupIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  partsGroupTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  partsGroupSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  partsRowItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12 },
  partsRowIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  partsRowInfo: { flex: 1, gap: 2 },
  partsRowName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  partsRowMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  partsRowMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  partsRowReceived: { fontSize: 10, fontFamily: "Inter_400Regular" },
  partsRowActions: { alignItems: "flex-end", gap: 5 },
  partsStatusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  partsStatusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  partsReceiveBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  partsReceiveBtnText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },

  floatingCta: { position: "absolute", right: 16, left: 16, alignItems: "center" },
  clockInFab: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 50, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  clockInFabText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  notFoundText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  backButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  odometerLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 1 },
  pendingSyncBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fef3c7", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  pendingSyncText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#d97706" },
  odometerRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" },
  takeActionBtn: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0 },
  takeActionBtnText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  mileageOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  mileageBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  mileageSheet: { width: "85%", borderRadius: 18, padding: 24, gap: 16, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  mileageTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  mileageSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -8 },
  mileageInputWrapper: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 },
  mileageInputLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  mileageInput: { fontSize: 18, fontFamily: "Inter_600SemiBold", padding: 0 },
  mileageActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  mileageCancelBtn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 12, borderWidth: 1.5 },
  mileageCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  mileageConfirmBtn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 12 },
  mileageConfirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
