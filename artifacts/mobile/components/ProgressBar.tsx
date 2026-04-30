import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  height?: number;
  color?: string;
}

export function ProgressBar({ progress, showLabel = false, height = 6, color }: ProgressBarProps) {
  const colors = useColors();
  const clamped = Math.min(100, Math.max(0, progress));
  const barColor = color ?? (clamped === 100 ? colors.success : colors.primary);

  return (
    <View>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Progress</Text>
          <Text style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{clamped}%</Text>
        </View>
      )}
      <View style={[styles.track, { height, backgroundColor: colors.secondary }]}>
        <View style={[styles.fill, { width: `${clamped}%` as `${number}%`, backgroundColor: barColor, height }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  track: {
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: {
    borderRadius: 99,
  },
});
