import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function ProgressRing({ progress, size = 56, strokeWidth = 5, label }: ProgressRingProps) {
  const colors = useColors();
  const clamped = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const color = clamped === 100 ? colors.success : colors.primary;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.ring, { borderRadius: size / 2, borderWidth: strokeWidth, borderColor: colors.secondary }]} />
      <View style={[styles.ring, { borderRadius: size / 2, borderWidth: strokeWidth, borderColor: "transparent" }]}>
        <View
          style={[
            styles.progress,
            {
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopColor: strokeDashoffset > circumference * 0.75 ? "transparent" : color,
              borderRightColor: strokeDashoffset > circumference * 0.5 ? "transparent" : color,
              borderBottomColor: strokeDashoffset > circumference * 0.25 ? "transparent" : color,
              width: size,
              height: size,
              transform: [{ rotate: "-90deg" }],
            },
          ]}
        />
      </View>
      <View style={styles.center}>
        <Text style={[styles.percentage, { color, fontSize: size * 0.22 }]}>
          {clamped}%
        </Text>
        {label && <Text style={[styles.label, { color: colors.mutedForeground, fontSize: size * 0.14 }]}>{label}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  progress: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  percentage: {
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontFamily: "Inter_400Regular",
  },
});
