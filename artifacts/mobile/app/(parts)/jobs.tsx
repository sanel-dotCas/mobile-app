import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import type { DimensionValue } from "react-native";
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
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

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
  parts: Part[];
}

interface Job {
  id: string;
  estimateNumber: string;
  licensePlate: string;
  vehicle: string;
  serviceAdvisor: string;
  status: string;
  tasks: Task[];
}

type FilterKey = "all" | "pending" | "ordered";

export default function PartsJobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const validFilter = (filterParam === "pending" || filterParam === "ordered" || filterParam === "all") ? filterParam : "pending";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>(validFilter);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/jobs`);
      if (res.ok) {
        const data = await res.json();
        const allJobs: Job[] = data.jobs ?? [];
        const withParts = allJobs.filter(
          (j) => j.tasks?.some((t) => (t.parts ?? []).length > 0)
        );
        setJobs(withParts);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const getParts = (job: Job) =>
    job.tasks.flatMap((t) => (t.parts ?? []).map((p) => ({ ...p, taskTitle: t.title })));

  const filteredJobs = jobs.filter((job) => {
    const parts = getParts(job);
    const activeFilter = searchQuery.trim() ? "all" : filter;
    const passesFilter =
      activeFilter === "pending"
        ? parts.some((p) => p.status === "pending")
        : activeFilter === "ordered"
        ? parts.some((p) => p.status === "ordered")
        : parts.length > 0;

    if (!passesFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchesPart = parts.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.partNumber.toLowerCase().includes(q)
      );
      return (
        job.estimateNumber.toLowerCase().includes(q) ||
        job.licensePlate.toLowerCase().includes(q) ||
        job.vehicle.toLowerCase().includes(q) ||
        matchesPart
      );
    }

    return true;
  });

  const statusCfg: Record<PartStatus, { label: string; color: string; bg: string }> = {
    pending: { label: "Pending", color: "#d97706", bg: "#fef3c7" },
    ordered: { label: "Ordered", color: "#0284c7", bg: "#e0f2fe" },
    received: { label: "Received", color: "#16a34a", bg: "#dcfce7" },
  };

  const FILTERS: Array<{ key: FilterKey; label: string }> = [
    { key: "pending", label: "Needs Order" },
    { key: "ordered", label: "Awaiting Delivery" },
    { key: "all", label: "All Jobs" },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Job Parts" subtitle="Parts required by job" showNotifications={false} />

      {/* Search bar */}
      <View style={[styles.searchRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={[styles.searchInputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search plate, estimate, vehicle or part…"
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterRow, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[
              styles.filterChip,
              { borderColor: filter === key ? "#7c3aed" : colors.border, backgroundColor: filter === key ? "#7c3aed" : colors.card },
            ]}
          >
            <Text style={[styles.filterChipText, { color: filter === key ? "#fff" : colors.mutedForeground }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        ) : filteredJobs.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="package" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No jobs found</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {searchQuery.trim()
                ? `No jobs match "${searchQuery.trim()}".`
                : filter === "pending"
                ? "No jobs have parts waiting to be ordered."
                : filter === "ordered"
                ? "No jobs have parts awaiting delivery."
                : "No jobs with parts found."}
            </Text>
          </View>
        ) : (
          filteredJobs.map((job) => {
            const allParts = getParts(job);
            const pendingCount = allParts.filter((p) => p.status === "pending").length;
            const orderedCount = allParts.filter((p) => p.status === "ordered").length;
            const receivedCount = allParts.filter((p) => p.status === "received").length;

            return (
              <Pressable
                key={job.id}
                onPress={() => router.push(`/parts/job?id=${job.id}`)}
                style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: "#000" }]}
              >
                {/* Header */}
                <View style={styles.jobCardHeader}>
                  <View style={styles.jobCardLeft}>
                    <Text style={[styles.jobEstimate, { color: colors.foreground }]}>{job.estimateNumber}</Text>
                    <Text style={[styles.jobVehicle, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {job.vehicle}
                    </Text>
                  </View>
                  <View style={styles.jobCardRight}>
                    <Text style={[styles.jobPlate, { color: colors.mutedForeground }]}>{job.licensePlate}</Text>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </View>
                </View>

                {/* Part status pills row */}
                <View style={styles.partStatusRow}>
                  {pendingCount > 0 && (
                    <View style={[styles.partStatusPill, { backgroundColor: statusCfg.pending.bg }]}>
                      <Feather name="clock" size={11} color={statusCfg.pending.color} />
                      <Text style={[styles.partStatusText, { color: statusCfg.pending.color }]}>
                        {pendingCount} pending
                      </Text>
                    </View>
                  )}
                  {orderedCount > 0 && (
                    <View style={[styles.partStatusPill, { backgroundColor: statusCfg.ordered.bg }]}>
                      <Feather name="truck" size={11} color={statusCfg.ordered.color} />
                      <Text style={[styles.partStatusText, { color: statusCfg.ordered.color }]}>
                        {orderedCount} ordered
                      </Text>
                    </View>
                  )}
                  {receivedCount > 0 && (
                    <View style={[styles.partStatusPill, { backgroundColor: statusCfg.received.bg }]}>
                      <Feather name="check-circle" size={11} color={statusCfg.received.color} />
                      <Text style={[styles.partStatusText, { color: statusCfg.received.color }]}>
                        {receivedCount} received
                      </Text>
                    </View>
                  )}
                </View>

                {/* Progress bar */}
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${allParts.length > 0 ? Math.round((receivedCount / allParts.length) * 100) : 0}%` as DimensionValue,
                        backgroundColor: receivedCount === allParts.length ? "#16a34a" : "#7c3aed",
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
                  {receivedCount} of {allParts.length} parts received
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchInputWrapper: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0, margin: 0 },
  filterRow: { borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row" },
  filterChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  jobCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  jobCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  jobCardLeft: { flex: 1, gap: 2 },
  jobCardRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  jobEstimate: { fontSize: 15, fontFamily: "Inter_700Bold" },
  jobVehicle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  jobPlate: { fontSize: 12, fontFamily: "Inter_500Medium" },
  partStatusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  partStatusPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  partStatusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
