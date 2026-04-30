import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { Job } from "@/context/JobsContext";

interface ClockInModalProps {
  visible: boolean;
  job: Job;
  taskTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClockInModal({ visible, job, taskTitle, onConfirm, onCancel }: ClockInModalProps) {
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent }]}>
            <Feather name="clock" size={28} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>Clock In</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Start tracking time for this task
          </Text>

          <View style={[styles.infoCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Job</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>Estimate {job.estimateNumber}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Vehicle</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{job.vehicle}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Task</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{taskTitle}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Start Time</Text>
              <Text style={[styles.infoValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onCancel(); }}
              style={[styles.cancelBtn, { backgroundColor: colors.secondary }]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => { onConfirm(); }}
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="play" size={15} color="#fff" />
              <Text style={styles.confirmBtnText}>Start Timer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    gap: 14,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: -6,
  },
  infoCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  infoDivider: {
    height: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    maxWidth: "60%",
    textAlign: "right",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  confirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
