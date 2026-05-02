import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useJobs } from "@/context/JobsContext";
import { useColors } from "@/hooks/useColors";

export default function WorkshopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useJobs();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const totalHours = state.technicians.reduce((s, t) => s + t.totalHoursToday, 0);
  const maxLoad = Math.max(...state.technicians.map((t) => t.totalHoursToday), 1);

  const jobsByStatus = {
    pending: state.jobs.filter((j) => j.status === "pending").length,
    in_progress: state.jobs.filter((j) => j.status === "in_progress").length,
    completed: state.jobs.filter((j) => j.status === "completed").length,
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Workshop Loading" subtitle="Workload Distribution" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summaryRow}>
          {[
            { label: "Total Hours\nToday", value: `${totalHours.toFixed(1)}h`, icon: "clock" as const, color: colors.primary },
            { label: "Active\nTechnicians", value: `${state.technicians.filter((t) => t.status === "active").length}`, icon: "users" as const, color: colors.success },
            { label: "Avg\nEfficiency", value: `${Math.round(state.technicians.filter((t) => t.status !== "absent").reduce((s, t) => s + t.efficiency, 0) / Math.max(1, state.technicians.filter((t) => t.status !== "absent").length))}%`, icon: "trending-up" as const, color: colors.info },
          ].map(({ label, value, icon, color }) => (
            <View key={label} style={[styles.summaryCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
              <View style={[styles.summaryIcon, { backgroundColor: color + "20" }]}>
                <Feather name={icon} size={18} color={color} />
              </View>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>{value}</Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Workload Bar Chart */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Technician Load</Text>
          {state.technicians.map((tech) => {
            const pct = maxLoad > 0 ? (tech.totalHoursToday / maxLoad) * 100 : 0;
            const assignedJobs = state.jobs.filter((j) => j.assignedTechnicianId === tech.id).length;
            return (
              <View key={tech.id} style={styles.loadRow}>
                <View style={[styles.loadAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.loadAvatarText}>{tech.avatar}</Text>
                </View>
                <View style={styles.loadInfo}>
                  <View style={styles.loadHeader}>
                    <Text style={[styles.loadName, { color: colors.foreground }]}>{tech.name}</Text>
                    <Text style={[styles.loadHours, { color: colors.mutedForeground }]}>
                      {tech.totalHoursToday}h · {assignedJobs} jobs
                    </Text>
                  </View>
                  <View style={[styles.loadTrack, { backgroundColor: colors.secondary }]}>
                    <View
                      style={[
                        styles.loadFill,
                        {
                          width: `${pct}%` as `${number}%`,
                          backgroundColor:
                            tech.status === "absent" ? colors.border :
                            pct > 85 ? colors.destructive :
                            pct > 60 ? colors.warning :
                            colors.success,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Job Pipeline */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Job Pipeline</Text>
          <View style={styles.pipeline}>
            {[
              { label: "Pending", count: jobsByStatus.pending, color: colors.warning, icon: "clock" as const },
              { label: "In Progress", count: jobsByStatus.in_progress, color: colors.info, icon: "activity" as const },
              { label: "Completed", count: jobsByStatus.completed, color: colors.success, icon: "check-circle" as const },
            ].map(({ label, count, color, icon }, i) => (
              <View key={label} style={styles.pipelineItem}>
                <View style={[styles.pipelineCard, { backgroundColor: color + "15", borderColor: color + "40" }]}>
                  <Feather name={icon} size={22} color={color} />
                  <Text style={[styles.pipelineCount, { color }]}>{count}</Text>
                </View>
                <Text style={[styles.pipelineLabel, { color: colors.mutedForeground }]}>{label}</Text>
                {i < 2 && <Feather name="arrow-right" size={14} color={colors.border} style={styles.pipelineArrow} />}
              </View>
            ))}
          </View>
        </View>

        {/* Stage breakdown per technician */}
        <View style={[styles.section, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Production Stages</Text>
          {state.technicians.filter((t) => t.status !== "absent").map((tech) => {
            const jobs = state.jobs.filter((j) => j.assignedTechnicianId === tech.id);
            if (jobs.length === 0) return null;
            return (
              <View key={tech.id} style={[styles.stageRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.stageTechName, { color: colors.foreground }]}>{tech.name}</Text>
                <View style={styles.stageBadges}>
                  {jobs.map((j) => (
                    <View key={j.id} style={[styles.stageBadge, { backgroundColor: j.status === "completed" ? colors.successLight : j.status === "in_progress" ? colors.infoLight : colors.warningLight }]}>
                      <Text style={[styles.stageBadgeText, { color: j.status === "completed" ? colors.success : j.status === "in_progress" ? colors.info : colors.warning }]}>
                        {j.estimateNumber}
                      </Text>
                    </View>
                  ))}
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
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 6, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  summaryIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  section: { borderRadius: 14, padding: 16, gap: 14, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  loadRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  loadAvatarText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  loadInfo: { flex: 1, gap: 5 },
  loadHeader: { flexDirection: "row", justifyContent: "space-between" },
  loadName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  loadHours: { fontSize: 11, fontFamily: "Inter_400Regular" },
  loadTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  loadFill: { height: "100%", borderRadius: 4 },
  pipeline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  pipelineItem: { alignItems: "center", gap: 6, position: "relative" },
  pipelineCard: { width: 80, height: 80, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  pipelineCount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  pipelineLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  pipelineArrow: { position: "absolute", right: -16, top: 32 },
  stageRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  stageTechName: { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 90 },
  stageBadges: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  stageBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
