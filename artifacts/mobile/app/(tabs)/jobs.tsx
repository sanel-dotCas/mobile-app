import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { JobCard } from "@/components/JobCard";
import { useJobs } from "@/context/JobsContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import type { JobStatus } from "@/context/JobsContext";

const BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

// Maps 2-letter technician code → full name used in yard assignment records
const CODE_TO_NAME: Record<string, string> = {
  MR: "Mike Rodriguez",
  JW: "James Wilson",
  CM: "Carlos Mendez",
  AH: "Ahmed Hassan",
  DP: "David Park",
};

type InspectionStatus = "queued" | "in-progress" | "finished";
type Urgency = "overdue" | "due-soon" | "ok";

interface AssignedInspection {
  id: number;
  inspectionNumber: string;
  vehicleName: string;
  vehicleYear?: number | null;
  type: string;
  status: InspectionStatus;
  locationName?: string | null;
  assignedTo?: string | null;
  assignedAt?: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  "pre-inspection": "Pre-Inspection",
  secondary: "Secondary",
  "final-quality": "Final Quality",
  "new-arrival": "New Arrival PDI",
  "used-arrival": "Used Arrival PDI",
  "periodic-fluid": "Periodic — Fluid Check",
  "periodic-damage": "Periodic — Damage Scan",
  "start-and-run": "Start & Run Cycle",
};

/**
 * Determine urgency based on how long ago the inspection was assigned.
 * Inspections assigned more than 2 days ago without being started are overdue.
 * Those assigned 1–2 days ago warrant attention. Recent assignments are on schedule.
 */
function getUrgency(insp: AssignedInspection): Urgency {
  const ref = insp.assignedAt ?? insp.createdAt;
  const daysSinceAssigned = Math.floor(
    (Date.now() - new Date(ref).getTime()) / 86400000
  );
  if (insp.status === "in-progress") return "ok";
  if (daysSinceAssigned >= 2) return "overdue";
  if (daysSinceAssigned >= 1) return "due-soon";
  return "ok";
}

const URGENCY_LABEL: Record<Urgency, string> = {
  overdue: "Overdue",
  "due-soon": "Due Today",
  ok: "Scheduled",
};
const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "#dc2626",
  "due-soon": "#d97706",
  ok: "#16a34a",
};
const URGENCY_BG: Record<Urgency, string> = {
  overdue: "#fef2f2",
  "due-soon": "#fef3c7",
  ok: "#dcfce7",
};

const INSP_STATUS_COLOR: Record<InspectionStatus, string> = {
  queued: "#d97706",
  "in-progress": "#1d4ed8",
  finished: "#16a34a",
};
const INSP_STATUS_BG: Record<InspectionStatus, string> = {
  queued: "#fef3c7",
  "in-progress": "#dbeafe",
  finished: "#dcfce7",
};
const INSP_STATUS_LABEL: Record<InspectionStatus, string> = {
  queued: "Queued",
  "in-progress": "In Progress",
  finished: "Finished",
};

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, refreshJobs, isRefreshing } = useJobs();
  const { t } = useLang();
  const { userCode } = useAuth();
  const router = useRouter();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const techName = CODE_TO_NAME[userCode] ?? null;

  const [myInspections, setMyInspections] = useState<AssignedInspection[]>([]);
  const [inspLoading, setInspLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [markingDoneId, setMarkingDoneId] = useState<number | null>(null);

  const loadInspections = useCallback(async () => {
    if (!techName) {
      setMyInspections([]);
      setInspLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({
        assignedTo: techName,
        status: "queued,in-progress",
        limit: "50",
      });
      const res = await fetch(`${BASE}/yard/inspections?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMyInspections(data.inspections ?? []);
    } catch {
      setMyInspections([]);
    } finally {
      setInspLoading(false);
    }
  }, [techName]);

  useEffect(() => { loadInspections(); }, [loadInspections]);

  const handleStartInspection = async (inspectionId: number) => {
    setStartingId(inspectionId);
    try {
      const res = await fetch(`${BASE}/yard/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in-progress" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadInspections();
    } catch {
      // non-critical — list will re-sync on next refresh
    } finally {
      setStartingId(null);
    }
  };

  const handleMarkDone = async (inspectionId: number) => {
    setMarkingDoneId(inspectionId);
    try {
      const res = await fetch(`${BASE}/yard/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "finished" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadInspections();
    } catch {
      // non-critical — list will re-sync on next refresh
    } finally {
      setMarkingDoneId(null);
    }
  };

  const FILTERS: Array<{ label: string; value: JobStatus | "all" }> = [
    { label: t.all,       value: "all" },
    { label: t.active,    value: "in_progress" },
    { label: t.pending,   value: "pending" },
    { label: t.completed, value: "completed" },
  ];

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<JobStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"date" | "progress" | "status">("date");

  const filtered = useMemo(() => {
    let jobs = state.jobs;
    if (activeFilter !== "all") {
      jobs = jobs.filter((j) => j.status === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.estimateNumber.toLowerCase().includes(q) ||
          j.licensePlate.toLowerCase().includes(q) ||
          j.vehicle.toLowerCase().includes(q) ||
          j.serviceAdvisor.toLowerCase().includes(q)
      );
    }
    return [...jobs].sort((a, b) => {
      if (sortBy === "progress") return b.progress - a.progress;
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime();
    });
  }, [state.jobs, activeFilter, search, sortBy]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title={t.jobs} subtitle={t.activeJobs} />

      <View style={[styles.controls, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.searchRow, { backgroundColor: colors.secondary, borderRadius: 10 }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t.search}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(({ label, value }) => (
            <Pressable
              key={value}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(value);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === value ? colors.primary : colors.secondary,
                  borderColor: activeFilter === value ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: activeFilter === value ? "#fff" : colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.filterCount,
                  { backgroundColor: activeFilter === value ? "rgba(255,255,255,0.25)" : colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    { color: activeFilter === value ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {value === "all"
                    ? state.jobs.length
                    : state.jobs.filter((j) => j.status === value).length}
                </Text>
              </View>
            </Pressable>
          ))}
          <View style={[styles.sortDivider, { backgroundColor: colors.border }]} />
          {(["date", "progress", "status"] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSortBy(s)}
              style={[
                styles.sortChip,
                { backgroundColor: sortBy === s ? colors.accent : "transparent" },
              ]}
            >
              <Feather name="bar-chart-2" size={11} color={sortBy === s ? colors.primary : colors.mutedForeground} />
              <Text
                style={[
                  styles.filterChipText,
                  { color: sortBy === s ? colors.primary : colors.mutedForeground },
                ]}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {!state.jobsLoaded ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Loading jobs…
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => { refreshJobs(); loadInspections(); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* ── Inspections section ── */}
          {(inspLoading || myInspections.length > 0) && (
            <View style={styles.inspectionsSection}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBg, { backgroundColor: "#7c3aed20" }]}>
                  <Feather name="clipboard" size={14} color="#7c3aed" />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Inspections
                </Text>
                {myInspections.length > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: "#7c3aed" }]}>
                    <Text style={styles.countBadgeText}>{myInspections.length}</Text>
                  </View>
                )}
              </View>

              {inspLoading ? (
                <View style={[styles.inspLoadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.inspLoadingText, { color: colors.mutedForeground }]}>Loading inspections…</Text>
                </View>
              ) : (
                myInspections.map((insp) => {
                  const urgency = getUrgency(insp);
                  const isStarting = startingId === insp.id;
                  const isMarkingDone = markingDoneId === insp.id;
                  return (
                    <Pressable
                      key={insp.id}
                      style={[styles.inspCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => router.push({ pathname: "/yard/inspection", params: { id: String(insp.id) } })}
                    >
                      <View style={styles.inspCardRow}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={styles.inspCardTop}>
                            <Text style={[styles.inspNum, { color: "#7c3aed" }]}>
                              #{insp.inspectionNumber}
                            </Text>
                            <View style={[styles.urgencyChip, { backgroundColor: URGENCY_BG[urgency] }]}>
                              <Text style={[styles.urgencyChipText, { color: URGENCY_COLOR[urgency] }]}>
                                {URGENCY_LABEL[urgency]}
                              </Text>
                            </View>
                            <View style={[styles.statusChip, { backgroundColor: INSP_STATUS_BG[insp.status] }]}>
                              <Text style={[styles.statusChipText, { color: INSP_STATUS_COLOR[insp.status] }]}>
                                {INSP_STATUS_LABEL[insp.status]}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.inspVehicle, { color: colors.foreground }]}>
                            {insp.vehicleName}{insp.vehicleYear ? ` (${insp.vehicleYear})` : ""}
                          </Text>
                          <Text style={[styles.inspType, { color: colors.mutedForeground }]}>
                            Inspection · {TYPE_LABELS[insp.type] ?? insp.type}
                          </Text>
                          {insp.locationName && (
                            <View style={styles.inspLocation}>
                              <Feather name="map-pin" size={10} color={colors.mutedForeground} />
                              <Text style={[styles.inspLocText, { color: colors.mutedForeground }]}>
                                {insp.locationName}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Action column */}
                        <View style={styles.inspCardActions}>
                          {insp.status === "queued" && (
                            <Pressable
                              style={[
                                styles.startBtn,
                                { backgroundColor: isStarting ? colors.muted : colors.primary },
                              ]}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleStartInspection(insp.id);
                              }}
                              disabled={isStarting}
                            >
                              {isStarting ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.startBtnText}>Start</Text>
                              )}
                            </Pressable>
                          )}
                          {insp.status === "in-progress" && (
                            <Pressable
                              style={[
                                styles.doneBtn,
                                { backgroundColor: isMarkingDone ? colors.muted : "#16a34a" },
                              ]}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleMarkDone(insp.id);
                              }}
                              disabled={isMarkingDone}
                            >
                              {isMarkingDone ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <Feather name="check" size={12} color="#fff" />
                                  <Text style={styles.doneBtnText}>Done</Text>
                                </>
                              )}
                            </Pressable>
                          )}
                          <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginTop: 4 }} />
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}

          {/* ── Jobs section ── */}
          <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
            {filtered.length} {filtered.length === 1 ? "job" : "jobs"}
          </Text>

          {filtered.length === 0 ? (
            <View style={styles.inlineEmpty}>
              <Feather name="briefcase" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No jobs found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {search ? "Try a different search term" : "No jobs match this filter"}
              </Text>
            </View>
          ) : (
            filtered.map((job) => (
              <JobCard key={job.id} job={job} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  controls: {
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterCountText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  sortDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 0,
  },
  resultCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  inlineEmpty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 32,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  inspectionsSection: {
    marginBottom: 20,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  inspLoadingCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inspLoadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  inspCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  inspCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  inspCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  inspCardActions: {
    alignItems: "center",
    gap: 6,
    paddingLeft: 4,
    paddingTop: 2,
  },
  startBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 56,
  },
  doneBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  inspNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  urgencyChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  urgencyChipText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  statusChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  inspVehicle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  inspType: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  inspLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  inspLocText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
