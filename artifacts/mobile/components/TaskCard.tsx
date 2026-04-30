import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { Task } from "@/context/JobsContext";
import { useJobs } from "@/context/JobsContext";
import { StatusPill } from "./StatusPill";
import { ProgressBar } from "./ProgressBar";

interface TaskCardProps {
  task: Task;
  jobId: string;
  onClockIn: () => void;
  onClockOut: () => void;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TaskCard({ task, jobId, onClockIn, onClockOut }: TaskCardProps) {
  const colors = useColors();
  const { addTaskNote, markTaskDone } = useJobs();
  const [expanded, setExpanded] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");

  const progress = task.estimatedHours > 0
    ? Math.min(100, Math.round((task.workedHours / task.estimatedHours) * 100))
    : 0;

  const handleMarkDone = () => {
    Alert.alert("Mark as Done", `Mark "${task.title}" as complete?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark Done", onPress: () => {
          if (task.clockedIn) onClockOut();
          markTaskDone(jobId, task.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      },
    ]);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addTaskNote(jobId, task.id, noteText.trim());
    setNoteText("");
    setShowNoteInput(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: task.clockedIn ? colors.primary : colors.border }]}>
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={[styles.taskTitle, { color: colors.foreground }]} numberOfLines={1}>{task.title}</Text>
            <View style={[styles.typeTag, { backgroundColor: colors.accent }]}>
              <Text style={[styles.typeTagText, { color: colors.primary }]}>{task.type}</Text>
            </View>
          </View>
          <View style={styles.hoursRow}>
            <View style={styles.hoursBadge}>
              <Feather name="clock" size={11} color={colors.primary} />
              <Text style={[styles.hoursText, { color: colors.mutedForeground }]}>{task.estimatedHours}h assigned</Text>
            </View>
            <Text style={[styles.separator, { color: colors.border }]}>|</Text>
            <View style={styles.hoursBadge}>
              <Feather name="user" size={11} color={colors.success} />
              <Text style={[styles.hoursText, { color: colors.mutedForeground }]}>{task.workedHours.toFixed(2)}h worked</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <StatusPill status={task.status} />
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </View>
      </Pressable>

      {task.clockedIn && (
        <View style={[styles.timerBanner, { backgroundColor: colors.accent }]}>
          <View style={styles.timerLeft}>
            <View style={[styles.timerDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.timerText, { color: colors.primary }]}>
              Active: {formatElapsed(task.elapsedSeconds)}
            </Text>
          </View>
          <Pressable
            onPress={() => { onClockOut(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
            style={[styles.stopBtn, { backgroundColor: colors.destructive }]}
          >
            <Feather name="square" size={12} color="#fff" />
            <Text style={styles.stopBtnText}>Stop</Text>
          </Pressable>
        </View>
      )}

      {task.status !== "done" && (
        <View style={styles.progressRow}>
          <ProgressBar progress={progress} height={4} />
          <Text style={[styles.progressPct, { color: colors.mutedForeground }]}>{progress}%</Text>
        </View>
      )}

      {expanded && (
        <View style={styles.expanded}>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{task.description}</Text>

          <View style={styles.techRow}>
            <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.techAvatarText}>
                {task.technician.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <Text style={[styles.techName, { color: colors.foreground }]}>{task.technician}</Text>
          </View>

          {task.notes.length > 0 && (
            <View style={styles.notesSection}>
              <Text style={[styles.notesSectionTitle, { color: colors.foreground }]}>Notes</Text>
              {task.notes.map((note) => (
                <View key={note.id} style={[styles.noteItem, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.noteAuthor, { color: colors.primary }]}>{note.author}</Text>
                  <Text style={[styles.noteText, { color: colors.foreground }]}>{note.text}</Text>
                  <Text style={[styles.noteTime, { color: colors.mutedForeground }]}>
                    {new Date(note.timestamp).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {showNoteInput && (
            <View style={[styles.noteInputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add a note..."
                placeholderTextColor={colors.mutedForeground}
                style={[styles.noteInput, { color: colors.foreground }]}
                multiline
                autoFocus
              />
              <View style={styles.noteInputActions}>
                <Pressable onPress={() => setShowNoteInput(false)} style={styles.cancelNoteBtn}>
                  <Text style={[styles.cancelNoteBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleAddNote} style={[styles.saveNoteBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.saveNoteBtnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.actions}>
            {task.status !== "done" && !task.clockedIn && (
              <Pressable
                onPress={() => { onClockIn(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }}
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="clock" size={13} color="#fff" />
                <Text style={styles.actionBtnText}>Clock In</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setShowNoteInput(!showNoteInput)}
              style={[styles.actionBtnOutline, { borderColor: colors.border }]}
            >
              <Feather name="message-square" size={13} color={colors.foreground} />
              <Text style={[styles.actionBtnOutlineText, { color: colors.foreground }]}>Add Note</Text>
            </Pressable>
            {task.status !== "done" && (
              <Pressable
                onPress={handleMarkDone}
                style={[styles.actionBtnOutline, { borderColor: colors.success }]}
              >
                <Feather name="check-circle" size={13} color={colors.success} />
                <Text style={[styles.actionBtnOutlineText, { color: colors.success }]}>Done</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {!expanded && (
        <View style={styles.collapsedLinks}>
          <Pressable onPress={() => setExpanded(true)}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Show details</Text>
          </Pressable>
          <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
          <Pressable onPress={() => setExpanded(true)}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Show update history</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 14,
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  typeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeTagText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hoursBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hoursText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  separator: {
    fontSize: 12,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  timerBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  timerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  timerText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  stopBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  progressPct: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    minWidth: 32,
    textAlign: "right",
  },
  expanded: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  techAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  techAvatarText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  techName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  notesSection: {
    gap: 6,
  },
  notesSectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  noteItem: {
    borderRadius: 8,
    padding: 10,
    gap: 3,
  },
  noteAuthor: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  noteText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  noteTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  noteInputContainer: {
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  noteInput: {
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 72,
    textAlignVertical: "top",
  },
  noteInputActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    padding: 10,
    paddingTop: 6,
  },
  cancelNoteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  cancelNoteBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  saveNoteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveNoteBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  actionBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  collapsedLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  linkText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  dot: {
    fontSize: 14,
  },
});
