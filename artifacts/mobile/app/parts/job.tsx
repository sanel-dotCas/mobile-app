import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import type { ComponentProps } from "react";
import type { DimensionValue } from "react-native";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

type PartStatus = "pending" | "ordered" | "received";

interface Part {
  id: string;
  name: string;
  partNumber: string;
  quantity: number;
  unit: string;
  status: PartStatus;
  price?: number;
  receivedAt?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  parts: Part[];
  [key: string]: unknown;
}

interface Job {
  id: string;
  estimateNumber: string;
  licensePlate: string;
  vehicle: string;
  serviceAdvisor: string;
  status: string;
  tasks: Task[];
  [key: string]: unknown;
}

const PART_CFG: Record<PartStatus, { label: string; color: string; bg: string; icon: FeatherIconName; next: PartStatus | null; nextLabel: string }> = {
  pending:  { label: "Pending",  color: "#d97706", bg: "#fef3c7", icon: "clock",        next: "ordered",  nextLabel: "Mark Ordered" },
  ordered:  { label: "Ordered",  color: "#0284c7", bg: "#e0f2fe", icon: "truck",        next: "received", nextLabel: "Mark Arrived" },
  received: { label: "Arrived",  color: "#16a34a", bg: "#dcfce7", icon: "check-circle", next: null,       nextLabel: "" },
};

export default function PartsJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${BASE}/jobs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job ?? null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updatePartStatus = async (taskId: string, partId: string, newStatus: PartStatus) => {
    if (!job) return;
    const saveKey = `${taskId}-${partId}`;
    setSaving(saveKey);

    const updatedTasks = job.tasks.map((task) => {
      if (task.id !== taskId) return task;
      return {
        ...task,
        parts: task.parts.map((p) => {
          if (p.id !== partId) return p;
          return {
            ...p,
            status: newStatus,
            ...(newStatus === "received" ? { receivedAt: new Date().toISOString() } : {}),
          };
        }),
      };
    });

    const optimisticJob = { ...job, tasks: updatedTasks };
    setJob(optimisticJob);

    try {
      const res = await fetch(`${BASE}/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: updatedTasks }),
      });
      if (!res.ok) {
        setJob(job);
        Alert.alert("Error", "Failed to update part status. Please try again.");
      }
    } catch {
      setJob(job);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  const handleStatusPress = (task: Task, part: Part) => {
    const cfg = PART_CFG[part.status];
    if (!cfg.next) return;
    const next = cfg.next;

    Alert.alert(
      cfg.nextLabel,
      `Update "${part.name}" to ${PART_CFG[next].label}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: cfg.nextLabel,
          onPress: () => updatePartStatus(task.id, part.id, next),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Job Parts" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Job Not Found" showBack />
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, marginTop: 12 }]}>Job not found</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: "#7c3aed" }]}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const tasksWithParts = job.tasks.filter((t) => (t.parts ?? []).length > 0);
  const allParts = job.tasks.flatMap((t) => t.parts ?? []);
  const pendingCount = allParts.filter((p) => p.status === "pending").length;
  const orderedCount = allParts.filter((p) => p.status === "ordered").length;
  const receivedCount = allParts.filter((p) => p.status === "received").length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`Estimate ${job.estimateNumber}`}
        subtitle={job.vehicle}
        showBack
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Job meta card */}
        <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.metaRow}>
            <Feather name="hash" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Plate</Text>
            <Text style={[styles.metaValue, { color: colors.foreground }]}>{job.licensePlate}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metaRow}>
            <Feather name="user" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Advisor</Text>
            <Text style={[styles.metaValue, { color: colors.foreground }]}>{job.serviceAdvisor}</Text>
          </View>
        </View>

        {/* Summary bar */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{allParts.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: pendingCount > 0 ? "#d97706" : colors.mutedForeground }]}>{pendingCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Pending</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: orderedCount > 0 ? "#0284c7" : colors.mutedForeground }]}>{orderedCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Ordered</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: receivedCount === allParts.length && allParts.length > 0 ? "#16a34a" : colors.foreground }]}>{receivedCount}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Arrived</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${allParts.length > 0 ? Math.round((receivedCount / allParts.length) * 100) : 0}%` as DimensionValue,
                backgroundColor: receivedCount === allParts.length && allParts.length > 0 ? "#16a34a" : "#7c3aed",
              },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
          {receivedCount} of {allParts.length} parts arrived
        </Text>

        {/* Parts grouped by task */}
        {tasksWithParts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="package" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No parts on this job</Text>
          </View>
        ) : (
          tasksWithParts.map((task) => {
            const taskReceived = (task.parts ?? []).filter((p) => p.status === "received").length;
            return (
              <View key={task.id} style={[styles.taskGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Task header */}
                <View style={[styles.taskHeader, { borderBottomColor: colors.border }]}>
                  <View style={[styles.taskIconWrap, { backgroundColor: colors.accent }]}>
                    <Feather name="tool" size={13} color="#7c3aed" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, { color: colors.foreground }]}>{task.title}</Text>
                    <Text style={[styles.taskSub, { color: colors.mutedForeground }]}>
                      {taskReceived}/{task.parts.length} arrived
                    </Text>
                  </View>
                </View>

                {/* Parts list */}
                {(task.parts ?? []).map((part, idx) => {
                  const cfg = PART_CFG[part.status];
                  const saveKey = `${task.id}-${part.id}`;
                  const isSaving = saving === saveKey;

                  return (
                    <View
                      key={part.id}
                      style={[
                        styles.partRow,
                        { borderTopColor: colors.border, borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth },
                      ]}
                    >
                      {/* Status icon */}
                      <View style={[styles.partIcon, { backgroundColor: cfg.bg }]}>
                        <Feather name={cfg.icon} size={13} color={cfg.color} />
                      </View>

                      {/* Part info */}
                      <View style={styles.partInfo}>
                        <Text style={[styles.partName, { color: colors.foreground }]} numberOfLines={2}>
                          {part.name}
                        </Text>
                        <View style={styles.partMeta}>
                          {part.partNumber ? (
                            <View style={[styles.partNumberBadge, { backgroundColor: colors.accent }]}>
                              <Text style={[styles.partNumberText, { color: "#7c3aed" }]}>#{part.partNumber}</Text>
                            </View>
                          ) : null}
                          <Text style={[styles.partMetaText, { color: colors.mutedForeground }]}>
                            ×{part.quantity} {part.unit}
                          </Text>
                          {part.price !== undefined && (
                            <Text style={[styles.partMetaText, { color: colors.mutedForeground }]}>
                              ${(part.price * part.quantity).toFixed(2)}
                            </Text>
                          )}
                        </View>
                        {part.receivedAt && (
                          <Text style={[styles.partReceivedAt, { color: "#16a34a" }]}>
                            Arrived {new Date(part.receivedAt).toLocaleDateString()}
                          </Text>
                        )}
                      </View>

                      {/* Status + action */}
                      <View style={styles.partActions}>
                        <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        {cfg.next && (
                          <Pressable
                            onPress={() => !isSaving && handleStatusPress(task, part)}
                            style={[styles.advanceBtn, { backgroundColor: PART_CFG[cfg.next].bg, opacity: isSaving ? 0.5 : 1 }]}
                          >
                            {isSaving ? (
                              <ActivityIndicator size="small" color={PART_CFG[cfg.next].color} />
                            ) : (
                              <>
                                <Feather name={PART_CFG[cfg.next].icon} size={11} color={PART_CFG[cfg.next].color} />
                                <Text style={[styles.advanceBtnText, { color: PART_CFG[cfg.next].color }]}>
                                  {cfg.nextLabel}
                                </Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  metaCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  metaLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 52 },
  metaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  metaDivider: { height: StyleSheet.hairlineWidth },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    paddingVertical: 12,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryDivider: { width: StyleSheet.hairlineWidth },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  taskGroup: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
  },
  taskIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  taskTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  taskSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  partRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
  },
  partIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  partInfo: { flex: 1, gap: 4 },
  partName: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  partMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  partNumberBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  partNumberText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  partMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  partReceivedAt: { fontSize: 11, fontFamily: "Inter_500Medium" },
  partActions: { alignItems: "flex-end", gap: 6, flexShrink: 0 },
  statusChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 90,
    justifyContent: "center",
  },
  advanceBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  backBtn: { marginTop: 12, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
