import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
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
import { JobCard } from "@/components/JobCard";
import { useJobs } from "@/context/JobsContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import type { JobStatus } from "@/context/JobsContext";

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useJobs();
  const { t } = useLang();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

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

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="briefcase" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No jobs found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            {search ? "Try a different search term" : "No jobs match this filter"}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
            {filtered.length} {filtered.length === 1 ? "job" : "jobs"}
          </Text>
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
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
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
