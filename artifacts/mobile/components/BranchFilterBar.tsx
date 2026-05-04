import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useBranch } from "@/context/BranchContext";
import { useColors } from "@/hooks/useColors";

function getIcon(type: string): React.ComponentProps<typeof Feather>["name"] {
  if (type === "DEALERSHIP_LOT") return "home";
  if (type === "YARD") return "map-pin";
  return "archive";
}

export function BranchFilterBar() {
  const colors = useColors();
  const { locations, selectedBranchId, setSelectedBranchId } = useBranch();

  if (locations.length === 0) return null;

  const selected = locations.find(l => l.id === selectedBranchId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Pressable
          onPress={() => setSelectedBranchId(null)}
          style={[
            styles.chip,
            {
              backgroundColor: selectedBranchId === null ? "#dc2626" : colors.card,
              borderColor: selectedBranchId === null ? "#dc2626" : colors.border,
            },
          ]}
        >
          <Feather
            name="globe"
            size={11}
            color={selectedBranchId === null ? "#fff" : colors.mutedForeground}
          />
          <Text
            style={[
              styles.chipText,
              { color: selectedBranchId === null ? "#fff" : colors.mutedForeground },
            ]}
          >
            All Branches
          </Text>
        </Pressable>

        {locations.map(loc => {
          const active = selectedBranchId === loc.id;
          return (
            <Pressable
              key={loc.id}
              onPress={() => setSelectedBranchId(active ? null : loc.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? "#dc2626" : colors.card,
                  borderColor: active ? "#dc2626" : colors.border,
                },
              ]}
            >
              <Feather
                name={getIcon(loc.type)}
                size={11}
                color={active ? "#fff" : colors.mutedForeground}
              />
              <Text
                style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}
                numberOfLines={1}
              >
                {loc.name}
              </Text>
              <View
                style={[
                  styles.typePill,
                  { backgroundColor: active ? "rgba(255,255,255,0.25)" : colors.muted },
                ]}
              >
                <Text
                  style={[
                    styles.typePillText,
                    { color: active ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {loc.type === "DEALERSHIP_LOT"
                    ? "DL"
                    : loc.type === "YARD"
                    ? "YD"
                    : "PA"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedBranchId !== null && selected && (
        <View style={[styles.activeBanner, { backgroundColor: "#fee2e2" }]}>
          <Feather name="filter" size={10} color="#dc2626" />
          <Text style={styles.activeBannerText}>
            Showing data for <Text style={{ fontFamily: "Inter_700Bold" }}>{selected.name}</Text>
          </Text>
          <Pressable onPress={() => setSelectedBranchId(null)} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: "row", alignItems: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", maxWidth: 110 },
  typePill: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  typePillText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  activeBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  activeBannerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: "#dc2626" },
  clearText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#dc2626" },
});
