import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { Part, PartStatus, Task } from "@/context/JobsContext";
import { useJobs } from "@/context/JobsContext";
import { useColors } from "@/hooks/useColors";
import { ProgressBar } from "./ProgressBar";
import { StatusPill } from "./StatusPill";

interface TaskCardProps {
  task: Task;
  jobId: string;
  onClockIn: () => void;
  onClockOut: () => void;
}

const LABOR_TYPE_CFG: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  ELECTRICAL: { bg: "#fef9c3", text: "#854d0e", border: "#fde047", icon: "zap" },
  MECHANICAL: { bg: "#dbeafe", text: "#1e3a8a", border: "#93c5fd", icon: "settings" },
  BODY:       { bg: "#fce7f3", text: "#831843", border: "#f9a8d4", icon: "shield" },
  PAINT:      { bg: "#ede9fe", text: "#4c1d95", border: "#c4b5fd", icon: "droplet" },
  DIAGNOSTIC: { bg: "#d1fae5", text: "#064e3b", border: "#6ee7b7", icon: "search" },
  OTHER:      { bg: "#f1f5f9", text: "#334155", border: "#cbd5e1", icon: "tool" },
};

const PART_STATUS_CFG: Record<PartStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: "Pending",  color: "#d97706", bg: "#fef3c7", icon: "clock"       },
  ordered:  { label: "Ordered",  color: "#0284c7", bg: "#e0f2fe", icon: "truck"       },
  received: { label: "Received", color: "#16a34a", bg: "#dcfce7", icon: "check-circle" },
};

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ─── Add Part Modal ─────────────────────────────────────── */
function AddPartModal({
  visible, onClose, onAdd,
}: { visible: boolean; onClose: () => void; onAdd: (part: Omit<Part, "id">) => void }) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => { setName(""); setPartNumber(""); setQty("1"); setUnit("pcs"); setPrice(""); setNotes(""); };

  const handleAdd = () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter a part name."); return; }
    onAdd({ name: name.trim(), partNumber: partNumber.trim(), quantity: parseInt(qty) || 1, unit: unit.trim() || "pcs", status: "pending", price: price ? parseFloat(price) : undefined, notes: notes.trim() || undefined });
    reset();
    onClose();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Request Part</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {[
              { label: "Part Name *", value: name, set: setName, placeholder: "e.g. Brake Pad Set" },
              { label: "Part Number", value: partNumber, set: setPartNumber, placeholder: "e.g. BP-001-F" },
            ].map(({ label, value, set, placeholder }) => (
              <View key={label} style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                <TextInput value={value} onChangeText={set} placeholder={placeholder} placeholderTextColor={colors.mutedForeground}
                  style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            ))}
            <View style={styles.row2}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Qty</Text>
                <TextInput value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="1" placeholderTextColor={colors.mutedForeground}
                  style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Unit</Text>
                <TextInput value={unit} onChangeText={setUnit} placeholder="pcs" placeholderTextColor={colors.mutedForeground}
                  style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Price ($)</Text>
                <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground}
                  style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Additional notes..." placeholderTextColor={colors.mutedForeground} multiline
                style={[styles.fieldInput, styles.fieldTextarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
            </View>
            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleAdd} style={[styles.submitBtn, { backgroundColor: colors.primary }]}>
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.submitBtnText}>Request Part</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

/* ─── Parts Panel ─────────────────────────────────────────── */
function PartsPanel({ parts, jobId, taskId }: { parts: Part[]; jobId: string; taskId: string }) {
  const colors = useColors();
  const { receivePart, updatePartStatus } = useJobs();
  const [showAdd, setShowAdd] = useState(false);
  const { addPart } = useJobs();

  const totalCost = parts.reduce((s, p) => s + (p.price ?? 0) * p.quantity, 0);
  const receivedCount = parts.filter((p) => p.status === "received").length;

  const handleReceive = (part: Part) => {
    Alert.alert(
      "Receive Part",
      `Mark "${part.name}" (${part.quantity} ${part.unit}) as received?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Received",
          onPress: () => {
            receivePart(jobId, taskId, part.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleCycleStatus = (part: Part) => {
    if (part.status === "received") return;
    const next: PartStatus = part.status === "pending" ? "ordered" : "received";
    Alert.alert(
      "Update Status",
      `Change "${part.name}" from ${part.status} → ${next}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: () => {
            if (next === "received") receivePart(jobId, taskId, part.id);
            else updatePartStatus(jobId, taskId, part.id, next);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.partsPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.partsHeader}>
        <View style={styles.partsHeaderLeft}>
          <Feather name="package" size={14} color={colors.primary} />
          <Text style={[styles.partsPanelTitle, { color: colors.foreground }]}>
            Parts & Materials
          </Text>
          <View style={[styles.partsBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.partsBadgeText, { color: colors.primary }]}>
              {receivedCount}/{parts.length}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => setShowAdd(true)}
          style={[styles.requestPartBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={11} color="#fff" />
          <Text style={styles.requestPartBtnText}>Request</Text>
        </Pressable>
      </View>

      {/* Summary bar */}
      {parts.length > 0 && (
        <View style={styles.partsSummary}>
          <ProgressBar progress={parts.length > 0 ? (receivedCount / parts.length) * 100 : 0} height={4} color="#16a34a" />
          <View style={styles.partsSummaryRow}>
            <Text style={[styles.partsSummaryText, { color: colors.mutedForeground }]}>
              {receivedCount} of {parts.length} received
            </Text>
            {totalCost > 0 && (
              <Text style={[styles.partsSummaryText, { color: colors.mutedForeground }]}>
                Total: ${totalCost.toFixed(2)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Parts list */}
      {parts.length === 0 ? (
        <View style={styles.partsEmpty}>
          <Feather name="package" size={22} color={colors.mutedForeground} />
          <Text style={[styles.partsEmptyText, { color: colors.mutedForeground }]}>No parts requested</Text>
        </View>
      ) : (
        parts.map((part) => {
          const cfg = PART_STATUS_CFG[part.status];
          return (
            <View key={part.id} style={[styles.partRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.partStatusIcon, { backgroundColor: cfg.bg }]}>
                <Feather name={cfg.icon as any} size={12} color={cfg.color} />
              </View>
              <View style={styles.partInfo}>
                <Text style={[styles.partName, { color: colors.foreground }]} numberOfLines={1}>
                  {part.name}
                </Text>
                <View style={styles.partMeta}>
                  {part.partNumber ? (
                    <Text style={[styles.partNumber, { color: colors.mutedForeground }]}>#{part.partNumber}</Text>
                  ) : null}
                  <Text style={[styles.partQty, { color: colors.mutedForeground }]}>
                    ×{part.quantity} {part.unit}
                  </Text>
                  {part.price !== undefined && (
                    <Text style={[styles.partPrice, { color: colors.mutedForeground }]}>
                      ${(part.price * part.quantity).toFixed(2)}
                    </Text>
                  )}
                </View>
                {part.receivedAt && (
                  <Text style={[styles.partReceivedAt, { color: colors.success }]}>
                    Received {new Date(part.receivedAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <View style={styles.partActions}>
                <Pressable
                  onPress={() => handleCycleStatus(part)}
                  style={[styles.partStatusPill, { backgroundColor: cfg.bg }]}
                >
                  <Text style={[styles.partStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                </Pressable>
                {part.status !== "received" && (
                  <Pressable
                    onPress={() => handleReceive(part)}
                    style={[styles.receiveBtn, { backgroundColor: colors.success }]}
                  >
                    <Feather name="check" size={11} color="#fff" />
                    <Text style={styles.receiveBtnText}>Receive</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })
      )}

      <AddPartModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={(part) => addPart(jobId, taskId, part)}
      />
    </View>
  );
}

/* ─── Main TaskCard ───────────────────────────────────────── */
export function TaskCard({ task, jobId, onClockIn, onClockOut }: TaskCardProps) {
  const colors = useColors();
  const { addTaskNote, markTaskDone } = useJobs();
  const [expanded, setExpanded] = useState(false);
  const [showParts, setShowParts] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSubject, setNoteSubject] = useState("");
  const [attachments, setAttachments] = useState<Array<{ uri: string; label: string; type: "image" | "document" }>>([]);
  const [attachLabel, setAttachLabel] = useState("");

  const laborCfg = LABOR_TYPE_CFG[task.laborType] ?? LABOR_TYPE_CFG.OTHER;
  const progress = task.estimatedHours > 0
    ? Math.min(100, Math.round((task.workedHours / task.estimatedHours) * 100))
    : 0;

  const pendingParts = task.parts.filter((p) => p.status !== "received").length;
  const allPartsReceived = task.parts.length > 0 && pendingParts === 0;

  const handleMarkDone = () => {
    if (pendingParts > 0) {
      Alert.alert(
        "Parts Not Received",
        `${pendingParts} part(s) haven't been received yet. Mark task as done anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Mark Done Anyway", style: "destructive", onPress: doMarkDone },
        ]
      );
      return;
    }
    doMarkDone();
  };

  const doMarkDone = () => {
    Alert.alert("Mark as Done", `Mark "${task.title}" as complete?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark Done", onPress: () => {
          if (task.clockedIn) onClockOut();
          markTaskDone(jobId, task.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
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
    addTaskNote(jobId, task.id, noteText.trim(), noteSubject.trim() || undefined, attachments.length > 0 ? attachments : undefined);
    setNoteText(""); setNoteSubject(""); setAttachments([]); setAttachLabel(""); setShowNoteInput(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: task.clockedIn ? colors.primary : colors.border }]}>

      {/* ── Labor Type Banner ─────────────────────────────── */}
      <View style={[styles.laborBanner, { backgroundColor: laborCfg.bg, borderBottomColor: laborCfg.border }]}>
        <View style={[styles.laborIconWrap, { backgroundColor: laborCfg.border }]}>
          <Feather name={laborCfg.icon as any} size={11} color={laborCfg.text} />
        </View>
        <Text style={[styles.laborType, { color: laborCfg.text }]}>{task.laborType}</Text>
        <View style={styles.laborMeta}>
          <Feather name="clock" size={10} color={laborCfg.text} />
          <Text style={[styles.laborMetaText, { color: laborCfg.text }]}>
            {task.estimatedHours.toFixed(2)} Assigned Hrs
          </Text>
          <Text style={[styles.laborMetaSep]}> | </Text>
          <Feather name="user" size={10} color={laborCfg.text} />
          <Text style={[styles.laborMetaText, { color: laborCfg.text }]}>
            {task.workedHours.toFixed(2)} Worked Hrs
          </Text>
        </View>
        {task.status !== "done" && (
          <Pressable
            onPress={() => {
              if (task.clockedIn) { onClockOut(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }
              else { onClockIn(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }
            }}
            style={[styles.clockInBtn, { backgroundColor: task.clockedIn ? colors.destructive : colors.primary }]}
          >
            <Feather name={task.clockedIn ? "square" : "clock"} size={11} color="#fff" />
            <Text style={styles.clockInBtnText}>{task.clockedIn ? "Stop" : "Clock-in"}</Text>
          </Pressable>
        )}
      </View>

      {/* ── Task Header ───────────────────────────────────── */}
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.taskTitle, { color: colors.foreground }]} numberOfLines={1}>{task.title}</Text>
          <Text style={[styles.taskType, { color: colors.mutedForeground }]}>{task.type}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.hoursLabel, { color: colors.foreground }]}>{task.estimatedHours.toFixed(2)} hrs</Text>
          <StatusPill status={task.status} />
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </View>
      </Pressable>

      {/* Parts alert strip */}
      {task.parts.length > 0 && !allPartsReceived && (
        <Pressable
          onPress={() => { setExpanded(true); setShowParts(true); }}
          style={[styles.partsAlert, { backgroundColor: pendingParts > 0 ? "#fef3c7" : "#e0f2fe" }]}
        >
          <Feather name="package" size={12} color={pendingParts > 0 ? "#d97706" : "#0284c7"} />
          <Text style={[styles.partsAlertText, { color: pendingParts > 0 ? "#d97706" : "#0284c7" }]}>
            {pendingParts} part{pendingParts !== 1 ? "s" : ""} awaiting receipt — tap to view
          </Text>
          <Feather name="chevron-right" size={12} color={pendingParts > 0 ? "#d97706" : "#0284c7"} />
        </Pressable>
      )}

      {/* Active timer */}
      {task.clockedIn && (
        <View style={[styles.timerBanner, { backgroundColor: colors.accent }]}>
          <View style={styles.timerLeft}>
            <View style={[styles.timerDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.timerText, { color: colors.primary }]}>Active: {formatElapsed(task.elapsedSeconds)}</Text>
          </View>
          <Pressable onPress={() => { onClockOut(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} style={[styles.stopBtn, { backgroundColor: colors.destructive }]}>
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

      {/* ── Expanded ──────────────────────────────────────── */}
      {expanded && (
        <View style={styles.expanded}>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{task.description}</Text>

          <View style={styles.techRow}>
            <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.techAvatarText}>{task.technician.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</Text>
            </View>
            <Text style={[styles.techName, { color: colors.foreground }]}>{task.technician}</Text>
          </View>

          {/* Parts toggle */}
          <Pressable
            onPress={() => setShowParts(!showParts)}
            style={[styles.partsToggle, { backgroundColor: allPartsReceived ? colors.successLight : pendingParts > 0 ? "#fef3c7" : colors.accent, borderColor: allPartsReceived ? colors.success : pendingParts > 0 ? "#fbbf24" : colors.primary }]}
          >
            <Feather name="package" size={14} color={allPartsReceived ? colors.success : pendingParts > 0 ? "#d97706" : colors.primary} />
            <Text style={[styles.partsToggleText, { color: allPartsReceived ? colors.success : pendingParts > 0 ? "#d97706" : colors.primary }]}>
              Parts & Materials ({task.parts.length})
              {pendingParts > 0 ? ` · ${pendingParts} pending` : allPartsReceived ? " · All received ✓" : ""}
            </Text>
            <Feather name={showParts ? "chevron-up" : "chevron-down"} size={14} color={allPartsReceived ? colors.success : pendingParts > 0 ? "#d97706" : colors.primary} />
          </Pressable>

          {showParts && <PartsPanel parts={task.parts} jobId={jobId} taskId={task.id} />}

          {/* Note history */}
          {task.notes.length > 0 && (
            <View style={styles.notesSection}>
              <Text style={[styles.notesSectionTitle, { color: colors.foreground }]}>Update History</Text>
              {task.notes.map((note) => (
                <View key={note.id} style={[styles.noteItem, { backgroundColor: colors.secondary, borderLeftColor: colors.primary }]}>
                  {note.subject ? <Text style={[styles.noteSubject, { color: colors.primary }]}>{note.subject}</Text> : null}
                  <Text style={[styles.noteText, { color: colors.foreground }]}>{note.text}</Text>
                  {note.attachments && note.attachments.length > 0 && (
                    <View style={styles.noteAttachments}>
                      {note.attachments.map((att, i) => (
                        att.type === "image"
                          ? <Image key={i} source={{ uri: att.uri }} style={styles.attachThumb} />
                          : <View key={i} style={[styles.docAttach, { backgroundColor: colors.accent }]}>
                              <Feather name="file" size={12} color={colors.primary} />
                              <Text style={[styles.docAttachText, { color: colors.primary }]}>{att.label}</Text>
                            </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.noteMeta}>
                    <Text style={[styles.noteAuthor, { color: colors.primary }]}>{note.author}</Text>
                    <Text style={[styles.noteTime, { color: colors.mutedForeground }]}>{new Date(note.timestamp).toLocaleDateString()}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Note input */}
          {showNoteInput && (
            <View style={[styles.noteInputContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput value={noteSubject} onChangeText={setNoteSubject} placeholder="Subject" placeholderTextColor={colors.mutedForeground}
                style={[styles.subjectInput, { color: colors.foreground, borderBottomColor: colors.border }]} />
              <TextInput value={noteText} onChangeText={setNoteText} placeholder="Add a note..." placeholderTextColor={colors.mutedForeground}
                style={[styles.noteInput, { color: colors.foreground }]} multiline autoFocus />
              <View style={styles.attachRow}>
                <TextInput value={attachLabel} onChangeText={setAttachLabel} placeholder="Attachment label" placeholderTextColor={colors.mutedForeground}
                  style={[styles.attachLabelInput, { color: colors.foreground, borderColor: colors.border }]} />
                <Pressable onPress={handleCamera} style={[styles.attachBtn, { borderColor: colors.border }]}>
                  <Feather name="camera" size={14} color={colors.mutedForeground} />
                </Pressable>
                <Pressable onPress={handlePickImage} style={[styles.attachBtn, { borderColor: colors.border }]}>
                  <Feather name="paperclip" size={14} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {attachments.length > 0 && (
                <View style={styles.previewRow}>
                  {attachments.map((att, i) => (
                    <View key={i} style={styles.previewWrap}>
                      {att.type === "image" ? <Image source={{ uri: att.uri }} style={styles.previewThumb} /> : <View style={[styles.docPreview, { backgroundColor: colors.accent }]}><Feather name="file" size={16} color={colors.primary} /></View>}
                      <Pressable onPress={() => setAttachments((p) => p.filter((_, j) => j !== i))} style={styles.removeAttach}>
                        <Feather name="x" size={10} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.noteInputActions}>
                <Pressable onPress={() => { setShowNoteInput(false); setNoteText(""); setNoteSubject(""); setAttachments([]); }} style={styles.cancelNoteBtn}>
                  <Text style={[styles.cancelNoteBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleAddNote} style={[styles.saveNoteBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.saveNoteBtnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable onPress={() => setShowNoteInput(!showNoteInput)} style={[styles.actionBtnOutline, { borderColor: colors.border }]}>
              <Feather name="message-square" size={13} color={colors.foreground} />
              <Text style={[styles.actionBtnOutlineText, { color: colors.foreground }]}>Add Note</Text>
            </Pressable>
            {task.status !== "done" && (
              <Pressable onPress={handleMarkDone} style={[styles.actionBtnOutline, { borderColor: colors.success }]}>
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
          <Pressable onPress={() => { setExpanded(true); setShowParts(true); }}>
            <Text style={[styles.linkText, { color: colors.primary }]}>
              Parts ({task.parts.filter((p) => p.status !== "received").length} pending)
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1.5, marginBottom: 12, overflow: "hidden" },

  laborBanner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, flexWrap: "wrap" },
  laborIconWrap: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  laborType: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  laborMeta: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  laborMetaText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  laborMetaSep: { fontSize: 10, color: "#94a3b8" },
  clockInBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  clockInBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },

  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14, paddingBottom: 8, gap: 10 },
  headerLeft: { flex: 1, gap: 3 },
  taskTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  taskType: { fontSize: 12, fontFamily: "Inter_400Regular" },
  headerRight: { alignItems: "flex-end", gap: 4 },
  hoursLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },

  partsAlert: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7 },
  partsAlertText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },

  timerBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8 },
  timerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  timerDot: { width: 7, height: 7, borderRadius: 4 },
  timerText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  stopBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  stopBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  progressPct: { fontSize: 11, fontFamily: "Inter_500Medium", minWidth: 32, textAlign: "right" },

  expanded: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
  description: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  techRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  techAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  techAvatarText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  techName: { fontSize: 13, fontFamily: "Inter_500Medium" },

  partsToggle: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1.5 },
  partsToggleText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },

  /* Parts Panel */
  partsPanel: { borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  partsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, paddingBottom: 8 },
  partsHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  partsPanelTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  partsBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  partsBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  requestPartBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  requestPartBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  partsSummary: { paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
  partsSummaryRow: { flexDirection: "row", justifyContent: "space-between" },
  partsSummaryText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  partsEmpty: { padding: 16, alignItems: "center", gap: 6 },
  partsEmptyText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  partRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  partStatusIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  partInfo: { flex: 1, gap: 2 },
  partName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  partMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  partNumber: { fontSize: 11, fontFamily: "Inter_400Regular" },
  partQty: { fontSize: 11, fontFamily: "Inter_500Medium" },
  partPrice: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  partReceivedAt: { fontSize: 10, fontFamily: "Inter_400Regular" },
  partActions: { alignItems: "flex-end", gap: 5 },
  partStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  partStatusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  receiveBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  receiveBtnText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },

  /* Note input */
  notesSection: { gap: 6 },
  notesSectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noteItem: { borderRadius: 8, padding: 10, gap: 4, borderLeftWidth: 3 },
  noteSubject: { fontSize: 12, fontFamily: "Inter_700Bold" },
  noteText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  noteMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  noteAuthor: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  noteTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  noteAttachments: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  attachThumb: { width: 48, height: 48, borderRadius: 6 },
  docAttach: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6, borderRadius: 6 },
  docAttachText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  noteInputContainer: { borderRadius: 10, borderWidth: 1.5, overflow: "hidden" },
  subjectInput: { padding: 12, paddingBottom: 10, fontSize: 13, fontFamily: "Inter_500Medium", borderBottomWidth: 1 },
  noteInput: { padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 72, textAlignVertical: "top" },
  attachRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingBottom: 10 },
  attachLabelInput: { flex: 1, height: 34, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, fontSize: 12, fontFamily: "Inter_400Regular" },
  attachBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  previewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  previewWrap: { position: "relative" },
  previewThumb: { width: 56, height: 56, borderRadius: 8 },
  docPreview: { width: 56, height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  removeAttach: { position: "absolute", top: -4, right: -4, backgroundColor: "#ef4444", borderRadius: 8, width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  noteInputActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, padding: 10, paddingTop: 6 },
  cancelNoteBtn: { paddingHorizontal: 14, paddingVertical: 7 },
  cancelNoteBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  saveNoteBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  saveNoteBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtnOutline: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5 },
  actionBtnOutlineText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  collapsedLinks: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  linkText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  dot: { fontSize: 14 },

  /* Add Part Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%", paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 5 },
  fieldInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  fieldTextarea: { minHeight: 72, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 10 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 12, borderWidth: 1.5 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  submitBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12 },
  submitBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
