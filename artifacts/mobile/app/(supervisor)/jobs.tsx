import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { useJobs } from "@/context/JobsContext";
import { useColors } from "@/hooks/useColors";

export default function SupervisorJobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, assignJob } = useJobs();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [assignModal, setAssignModal] = useState<{ jobId: string } | null>(null);

  const handleAssign = (jobId: string, techId: string) => {
    assignJob(jobId, techId);
    setAssignModal(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Assigned Jobs" subtitle="Supervisor View" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{state.jobs.length} total jobs</Text>
        {state.jobs.map((job) => {
          const tech = job.assignedTechnicianId
            ? state.technicians.find((t) => t.id === job.assignedTechnicianId)
            : null;
          return (
            <View key={job.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: "#000" }]}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={[styles.estimateNum, { color: colors.foreground }]}>Estimate {job.estimateNumber}</Text>
                  <Text style={[styles.vehicle, { color: colors.mutedForeground }]}>{job.vehicle}</Text>
                  <View style={styles.metaRow}>
                    <Feather name="hash" size={11} color={colors.primary} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{job.licensePlate}</Text>
                    <Feather name="clock" size={11} color={colors.primary} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{job.totalEstimatedHours}h</Text>
                  </View>
                </View>
                <StatusPill status={job.status} size="md" />
              </View>

              <View style={styles.progressSection}>
                <ProgressBar progress={job.progress} height={5} showLabel />
              </View>

              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <View style={styles.techSection}>
                  {tech ? (
                    <View style={styles.techRow}>
                      <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.techAvatarText}>{tech.avatar}</Text>
                      </View>
                      <View>
                        <Text style={[styles.techName, { color: colors.foreground }]}>{tech.name}</Text>
                        <Text style={[styles.techRole, { color: colors.mutedForeground }]}>{tech.role}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.unassigned, { color: colors.warning }]}>⚠ Unassigned</Text>
                  )}
                </View>
                <Pressable
                  onPress={() => setAssignModal({ jobId: job.id })}
                  style={[styles.assignBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="user-plus" size={12} color="#fff" />
                  <Text style={styles.assignBtnText}>{tech ? "Reassign" : "Assign"}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Assign Modal */}
      {assignModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setAssignModal(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setAssignModal(null)}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Assign Technician</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {state.technicians.filter((t) => t.status !== "absent").map((tech) => (
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
                      <Text style={[styles.techRole, { color: colors.mutedForeground }]}>
                        {tech.role} · {tech.efficiency}% efficiency
                      </Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: tech.status === "active" ? "#16a34a" : tech.status === "idle" ? "#64748b" : "#d97706" }]} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  count: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14, paddingBottom: 10 },
  cardLeft: { flex: 1, gap: 3 },
  estimateNum: { fontSize: 16, fontFamily: "Inter_700Bold" },
  vehicle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  progressSection: { paddingHorizontal: 14, paddingBottom: 12 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderTopWidth: 1 },
  techSection: { flex: 1 },
  techRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  techAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  techAvatarText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  techName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  techRole: { fontSize: 11, fontFamily: "Inter_400Regular" },
  unassigned: { fontSize: 13, fontFamily: "Inter_500Medium" },
  assignBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  assignBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%", paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 },
  techOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  techOptionInfo: { flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
