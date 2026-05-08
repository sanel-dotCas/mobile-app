import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
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
import { useEfficiencyThresholds } from "@/context/EfficiencyThresholdsContext";
import { useJobs } from "@/context/JobsContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const STATUS_COLORS = { active: "#16a34a", idle: "#64748b", break: "#d97706", absent: "#ef4444" };

const BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

interface YardInspItem { id: number; type: string; status: string; vehicleName: string; stockNumber: string | null; }

export default function TechniciansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useJobs();
  const { t } = useLang();
  const { effColor: getEffColor } = useEfficiencyThresholds();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [filter, setFilter] = useState<"all" | "active" | "idle" | "break" | "absent">("all");

  const [yardByTech, setYardByTech] = useState<Record<string, YardInspItem[]>>({});

  const loadYardInspections = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/yard/inspections?status=queued,in-progress&limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, YardInspItem[]> = {};
      for (const insp of data.inspections ?? []) {
        if (insp.assignedTo) {
          if (!map[insp.assignedTo]) map[insp.assignedTo] = [];
          map[insp.assignedTo].push({
            id: insp.id,
            type: insp.type,
            status: insp.status,
            vehicleName: insp.vehicleName,
            stockNumber: insp.stockNumber,
          });
        }
      }
      setYardByTech(map);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadYardInspections();
    const interval = setInterval(loadYardInspections, 30000);
    return () => clearInterval(interval);
  }, [loadYardInspections]);

  const STATUS_LABELS = { active: t.active, idle: t.idle, break: t.onBreak, absent: t.absent };

  const filtered = filter === "all" ? state.technicians : state.technicians.filter((tech) => tech.status === filter);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title={t.technicians} subtitle={t.teamOverview} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={[styles.filterScroll, { borderBottomColor: colors.border }]}
      >
        {(["all", "active", "idle", "break", "absent"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterChip,
              { backgroundColor: filter === f ? colors.primary : colors.secondary, borderColor: filter === f ? colors.primary : colors.border },
            ]}
          >
            <Text style={[styles.filterText, { color: filter === f ? "#fff" : colors.mutedForeground }]}>
              {f === "all" ? `${t.all} (${state.technicians.length})` : STATUS_LABELS[f]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((tech) => {
          const assignedJobs = state.jobs.filter((j) => j.assignedTechnicianId === tech.id);
          const statusColor = STATUS_COLORS[tech.status];
          const currentJob = tech.currentJobId ? state.jobs.find((j) => j.id === tech.currentJobId) : null;
          const effColor = getEffColor(tech.efficiency, colors);
          return (
            <View key={tech.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: "#000" }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{tech.avatar}</Text>
                </View>
                <View style={styles.headerInfo}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{tech.name}</Text>
                  <Text style={[styles.role, { color: colors.mutedForeground }]}>{tech.role}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColor + "20" }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[tech.status]}</Text>
                </View>
              </View>

              {currentJob && (
                <View style={[styles.currentJobBanner, { backgroundColor: colors.accent }]}>
                  <Feather name="briefcase" size={12} color={colors.primary} />
                  <Text style={[styles.currentJobText, { color: colors.primary }]} numberOfLines={1}>
                    Working: Estimate {currentJob.estimateNumber} · {currentJob.vehicle}
                  </Text>
                </View>
              )}

              <View style={[styles.statsGrid, { borderTopColor: colors.border }]}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{tech.totalHoursToday}h</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Today</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>{assignedJobs.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Workshop</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: "#7c3aed" }]}>{(yardByTech[tech.name] ?? []).length}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Yard Insp.</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: effColor }]}>{tech.efficiency}%</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Efficiency</Text>
                </View>
              </View>

              <View style={styles.efficiencySection}>
                <Text style={[styles.effLabel, { color: colors.mutedForeground }]}>Efficiency</Text>
                <ProgressBar
                  progress={tech.efficiency}
                  height={6}
                  color={effColor}
                />
              </View>

              {assignedJobs.length > 0 && (
                <View style={[styles.jobsList, { borderTopColor: colors.border }]}>
                  <Text style={[styles.jobsListTitle, { color: colors.mutedForeground }]}>Workshop Jobs</Text>
                  {assignedJobs.map((job) => (
                    <View key={job.id} style={styles.jobItem}>
                      <Text style={[styles.jobEstimate, { color: colors.foreground }]}>Estimate {job.estimateNumber}</Text>
                      <Text style={[styles.jobVehicle, { color: colors.mutedForeground }]} numberOfLines={1}>{job.vehicle}</Text>
                    </View>
                  ))}
                </View>
              )}

              {(yardByTech[tech.name] ?? []).length > 0 && (
                <View style={[styles.jobsList, { borderTopColor: colors.border, backgroundColor: "#faf5ff" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Feather name="clipboard" size={11} color="#7c3aed" />
                    <Text style={[styles.jobsListTitle, { color: "#7c3aed", marginBottom: 0 }]}>Yard Inspections</Text>
                  </View>
                  {(yardByTech[tech.name] ?? []).map((insp) => {
                    const TYPE_LABELS: Record<string, string> = {
                      "pre-inspection": "Pre-Insp.", secondary: "Secondary", "final-quality": "Final QC",
                      "new-arrival": "New Arrival", "used-arrival": "Used Arrival",
                      "periodic-fluid": "Fluid Check", "periodic-damage": "Damage Scan", "start-and-run": "Start & Run",
                    };
                    const statusColor = insp.status === "in-progress" ? "#1d4ed8" : "#d97706";
                    return (
                      <View key={insp.id} style={styles.jobItem}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.jobEstimate, { color: colors.foreground }]}>
                            {TYPE_LABELS[insp.type] ?? insp.type}
                          </Text>
                          <View style={[styles.yardStatusPill, { backgroundColor: statusColor + "20" }]}>
                            <Text style={[styles.yardStatusText, { color: statusColor }]}>
                              {insp.status === "in-progress" ? "In Progress" : "Queued"}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.jobVehicle, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {insp.vehicleName}{insp.stockNumber ? ` — #${insp.stockNumber}` : ""}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  filterScroll: { borderBottomWidth: 1, maxHeight: 52 },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  headerInfo: { flex: 1 },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  role: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  currentJobBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  currentJobText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  statsGrid: { flexDirection: "row", borderTopWidth: 1, paddingVertical: 12 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, alignSelf: "stretch" },
  efficiencySection: { paddingHorizontal: 14, paddingBottom: 12, gap: 6 },
  effLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  jobsList: { borderTopWidth: 1, padding: 14, gap: 8 },
  jobsListTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  jobItem: { gap: 1 },
  jobEstimate: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  jobVehicle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  yardStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  yardStatusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});
