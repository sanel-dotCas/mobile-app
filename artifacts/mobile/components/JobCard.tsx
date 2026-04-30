import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { Job } from "@/context/JobsContext";
import { StatusPill } from "./StatusPill";
import { ProgressBar } from "./ProgressBar";

interface JobCardProps {
  job: Job;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function JobCard({ job }: JobCardProps) {
  const colors = useColors();
  const router = useRouter();

  const isActive = job.tasks.some((t) => t.clockedIn);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/job/${job.id}`);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? colors.primary : colors.border,
          opacity: pressed ? 0.95 : 1,
          shadowColor: "#000",
        },
      ]}
    >
      {isActive && (
        <View style={[styles.activeBanner, { backgroundColor: colors.primary }]}>
          <Feather name="clock" size={11} color="#fff" />
          <Text style={styles.activeBannerText}>Active Timer</Text>
        </View>
      )}

      <View style={styles.top}>
        <View style={styles.thumbnailContainer}>
          {job.thumbnail ? (
            <Image source={{ uri: job.thumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbPlaceholder, { backgroundColor: colors.accent }]}>
              <Feather name="truck" size={22} color={colors.primary} />
            </View>
          )}
        </View>
        <View style={styles.topInfo}>
          <View style={styles.estimateRow}>
            <Text style={[styles.estimateNumber, { color: colors.foreground }]}>
              Estimate {job.estimateNumber}
            </Text>
            <StatusPill status={job.status} />
          </View>
          <View style={styles.metaRow}>
            <Feather name="hash" size={11} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{job.licensePlate}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="truck" size={11} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{job.vehicle}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="user" size={11} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{job.serviceAdvisor}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.metaRow}>
            <Feather name="clock" size={11} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{job.totalEstimatedHours}h est.</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={11} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatDate(job.appointmentDate)}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/job/${job.id}`);
          }}
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.actionBtnText}>Take Action</Text>
          <Feather name="arrow-right" size={12} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.progressSection}>
        <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
          Overall Progress — {job.workedHours}/{job.totalEstimatedHours}h ({job.progress}%)
        </Text>
        <ProgressBar progress={job.progress} height={5} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  activeBannerText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  top: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
  },
  thumbnailContainer: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: "hidden",
    flexShrink: 0,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  thumbPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  topInfo: {
    flex: 1,
    gap: 3,
  },
  estimateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  estimateNumber: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footerLeft: {
    gap: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  progressSection: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 5,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
