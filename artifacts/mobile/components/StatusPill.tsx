import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { JobStatus, TaskStatus } from "@/context/JobsContext";

interface StatusPillProps {
  status: JobStatus | TaskStatus | "pass" | "fail";
  size?: "sm" | "md";
}

export function StatusPill({ status, size = "sm" }: StatusPillProps) {
  const colors = useColors();

  const config = {
    pending: { bg: colors.warningLight, text: colors.warning, label: "Pending" },
    in_progress: { bg: colors.infoLight, text: colors.info, label: "In Progress" },
    completed: { bg: colors.successLight, text: colors.success, label: "Completed" },
    done: { bg: colors.successLight, text: colors.success, label: "Done" },
    pass: { bg: colors.successLight, text: colors.success, label: "Pass" },
    fail: { bg: "#fee2e2", text: colors.destructive, label: "Fail" },
  };

  const { bg, text, label } = config[status] ?? config.pending;
  const isMd = size === "md";

  return (
    <View style={[styles.pill, { backgroundColor: bg, paddingHorizontal: isMd ? 10 : 7, paddingVertical: isMd ? 4 : 2 }]}>
      <Text style={[styles.text, { color: text, fontSize: isMd ? 12 : 10 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: "Inter_600SemiBold",
  },
});
