import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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
import { StatusPill } from "@/components/StatusPill";
import { TaskCard } from "@/components/TaskCard";
import { ProgressBar } from "@/components/ProgressBar";
import { useJobs } from "@/context/JobsContext";
import { useColors } from "@/hooks/useColors";
import type { InspectionItem } from "@/context/JobsContext";
import { ClockInModal } from "@/components/ClockInModal";

type TabKey = "tasks" | "notes" | "inspections";

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
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    width: "48%",
    marginBottom: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 1,
  },
  value: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});

function InspectionCard({ item }: { item: InspectionItem }) {
  const colors = useColors();
  return (
    <View style={[inspStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={inspStyles.row}>
        <View style={inspStyles.left}>
          <Text style={[inspStyles.title, { color: colors.foreground }]}>{item.title}</Text>
          <Text style={[inspStyles.hours, { color: colors.mutedForeground }]}>{item.estimatedHours}h estimated</Text>
          {item.notes ? (
            <Text style={[inspStyles.notes, { color: colors.mutedForeground }]}>{item.notes}</Text>
          ) : null}
        </View>
        <StatusPill status={item.status} size="md" />
      </View>
    </View>
  );
}

const inspStyles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  left: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  hours: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  notes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
});

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getJob, clockIn, clockOut, addNote, markJobComplete } = useJobs();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [noteText, setNoteText] = useState("");
  const [clockInModal, setClockInModal] = useState<{ jobId: string; taskId: string; taskTitle: string } | null>(null);

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

  const handleClockIn = (taskId: string, taskTitle: string) => {
    if (activeClockedTask && activeClockedTask.id !== taskId) {
      Alert.alert(
        "Switch Task?",
        `You're currently clocked into "${activeClockedTask.title}". Clock out first.`,
        [{ text: "OK" }]
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

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(job.id, noteText.trim());
    setNoteText("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const TABS: Array<{ key: TabKey; label: string }> = [
    { key: "tasks", label: "Tasks" },
    { key: "notes", label: "Notes" },
    { key: "inspections", label: "Inspections" },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`Estimate ${job.estimateNumber}`}
        subtitle={`${job.vehicle}`}
        showBack
        rightElement={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => {
                Alert.alert("Mark Complete", "Mark all tasks in this job as complete?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Complete", onPress: () => { markJobComplete(job.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
                ]);
              }}
              style={[styles.headerBtn, { borderColor: colors.success }]}
            >
              <Text style={[styles.headerBtnText, { color: colors.success }]}>Complete</Text>
            </Pressable>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Metadata Row */}
        <View style={[styles.metaCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <View style={styles.metaGrid}>
            <MetaItem icon="hash" label="License Plate" value={job.licensePlate} />
            <MetaItem icon="truck" label="Vehicle" value={job.vehicle} />
            <MetaItem icon="user" label="Service Advisor" value={job.serviceAdvisor} />
            <MetaItem icon="clock" label="Est. Hours" value={`${job.totalEstimatedHours}h`} />
            <MetaItem icon="activity" label="Odometer" value={`${job.odometer.toLocaleString()} km`} />
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

        {/* Active Clock-in Banner */}
        {activeClockedTask && (
          <View style={[styles.activeTimerBanner, { backgroundColor: colors.primary }]}>
            <View style={styles.timerBannerLeft}>
              <View style={styles.timerPulse}>
                <View style={[styles.timerDot, { backgroundColor: "#fff" }]} />
              </View>
              <View>
                <Text style={styles.timerBannerTitle}>Active: {activeClockedTask.title}</Text>
                <Text style={styles.timerBannerTime}>
                  {formatElapsed(activeClockedTask.elapsedSeconds)}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => handleClockOut(activeClockedTask.id)}
              style={styles.stopTimerBtn}
            >
              <Feather name="square" size={14} color={colors.primary} />
              <Text style={[styles.stopTimerBtnText, { color: colors.primary }]}>Stop</Text>
            </Pressable>
          </View>
        )}

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TABS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => { setActiveTab(key); Haptics.selectionAsync(); }}
              style={[
                styles.tabItem,
                activeTab === key && [styles.tabItemActive, { borderBottomColor: colors.primary }],
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === key ? colors.primary : colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
              {key === "tasks" && (
                <View style={[styles.tabBadge, { backgroundColor: activeTab === key ? colors.primary : colors.muted }]}>
                  <Text style={[styles.tabBadgeText, { color: activeTab === key ? "#fff" : colors.mutedForeground }]}>
                    {job.tasks.length}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <View style={styles.tabContent}>
            <View style={[styles.tasksSummary, { backgroundColor: colors.card, shadowColor: "#000" }]}>
              <View style={styles.taskSummaryItem}>
                <Text style={[styles.taskSummaryValue, { color: colors.foreground }]}>
                  {job.tasks.filter((t) => t.status === "done").length}/{job.tasks.length}
                </Text>
                <Text style={[styles.taskSummaryLabel, { color: colors.mutedForeground }]}>Tasks Done</Text>
              </View>
              <View style={[styles.taskSummaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.taskSummaryItem}>
                <Text style={[styles.taskSummaryValue, { color: colors.foreground }]}>
                  {job.workedHours.toFixed(1)}h
                </Text>
                <Text style={[styles.taskSummaryLabel, { color: colors.mutedForeground }]}>Worked</Text>
              </View>
              <View style={[styles.taskSummaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.taskSummaryItem}>
                <Text style={[styles.taskSummaryValue, { color: colors.foreground }]}>
                  {job.totalEstimatedHours}h
                </Text>
                <Text style={[styles.taskSummaryLabel, { color: colors.mutedForeground }]}>Assigned</Text>
              </View>
            </View>
            {job.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                jobId={job.id}
                onClockIn={() => handleClockIn(task.id, task.title)}
                onClockOut={() => handleClockOut(task.id)}
              />
            ))}
          </View>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <View style={styles.tabContent}>
            <View style={[styles.noteInputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add a note to this job..."
                placeholderTextColor={colors.mutedForeground}
                style={[styles.noteInput, { color: colors.foreground }]}
                multiline
              />
              <Pressable
                onPress={handleAddNote}
                style={[styles.addNoteBtn, { backgroundColor: colors.primary, opacity: noteText.trim() ? 1 : 0.5 }]}
                disabled={!noteText.trim()}
              >
                <Feather name="send" size={14} color="#fff" />
                <Text style={styles.addNoteBtnText}>Add Note</Text>
              </Pressable>
            </View>
            {job.notes.length === 0 ? (
              <View style={styles.emptyNotes}>
                <Feather name="message-square" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyNotesText, { color: colors.mutedForeground }]}>No notes yet</Text>
              </View>
            ) : (
              [...job.notes].reverse().map((note) => (
                <View key={note.id} style={[styles.noteItem, { backgroundColor: colors.card, shadowColor: "#000" }]}>
                  <View style={styles.noteHeader}>
                    <View style={[styles.noteAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.noteAvatarText}>
                        {note.author.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.noteAuthor, { color: colors.foreground }]}>{note.author}</Text>
                      <Text style={[styles.noteTime, { color: colors.mutedForeground }]}>
                        {new Date(note.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.noteBody, { color: colors.foreground }]}>{note.text}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Inspections Tab */}
        {activeTab === "inspections" && (
          <View style={styles.tabContent}>
            {job.inspections.length === 0 ? (
              <View style={styles.emptyNotes}>
                <Feather name="clipboard" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyNotesText, { color: colors.mutedForeground }]}>No inspections recorded</Text>
              </View>
            ) : (
              job.inspections.map((item) => (
                <InspectionCard key={item.id} item={item} />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Clock-in CTA */}
      {!activeClockedTask && job.status !== "completed" && (
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
        <ClockInModal
          visible={!!clockInModal}
          job={job}
          taskTitle={clockInModal.taskTitle}
          onConfirm={confirmClockIn}
          onCancel={() => setClockInModal(null)}
        />
      )}
    </View>
  );
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
    gap: 14,
  },
  headerActions: {
    flexDirection: "row",
    gap: 6,
  },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  headerBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  metaCard: {
    borderRadius: 14,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metaDivider: {
    height: 1,
    marginVertical: 12,
  },
  metaFooter: {
    gap: 10,
  },
  metaStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaAppt: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  activeTimerBanner: {
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timerBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timerPulse: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timerBannerTitle: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  timerBannerTime: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  stopTimerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  stopTimerBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabItemActive: {},
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  tabContent: {
    gap: 0,
  },
  tasksSummary: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  taskSummaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  taskSummaryDivider: {
    width: 1,
    alignSelf: "stretch",
  },
  taskSummaryValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  taskSummaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  noteInputCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: "hidden",
    marginBottom: 14,
  },
  noteInput: {
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 72,
    textAlignVertical: "top",
  },
  addNoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    margin: 10,
    marginTop: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9,
    alignSelf: "flex-end",
  },
  addNoteBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyNotes: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyNotesText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  noteItem: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 10,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noteAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  noteAvatarText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  noteAuthor: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  noteTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  noteBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  floatingCta: {
    position: "absolute",
    right: 16,
    left: 16,
    alignItems: "center",
  },
  clockInFab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 50,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  clockInFabText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  notFoundText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
