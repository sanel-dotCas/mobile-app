import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";

const BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

type InspectionStatus = "queued" | "in-progress" | "finished";

interface Inspection {
  id: number;
  inspectionNumber: string;
  vehicleName: string;
  stockVin: string;
  type: string;
  status: InspectionStatus;
  locationName?: string;
  notes?: string;
  bodyDamage?: string;
  fuelPercentage?: number;
  createdAt: string;
  completedAt?: string;
}

const STATUS_LABEL: Record<InspectionStatus, string> = {
  queued: "Queued",
  "in-progress": "In Progress",
  finished: "Finished",
};
const STATUS_COLOR: Record<InspectionStatus, string> = {
  queued: "#d97706",
  "in-progress": "#1d4ed8",
  finished: "#16a34a",
};
const STATUS_BG: Record<InspectionStatus, string> = {
  queued: "#fef3c7",
  "in-progress": "#dbeafe",
  finished: "#dcfce7",
};

const TYPE_LABEL: Record<string, string> = {
  "pre-inspection": "Pre-Inspection (PDI)",
  "secondary": "Secondary Check",
  "final-quality": "Final Quality Check",
};

export default function InspectionDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = () => {
    if (!id) return;
    fetch(`${BASE}/yard/inspections?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const found = (data.inspections ?? []).find((i: Inspection) => String(i.id) === id);
        setInspection(found ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: InspectionStatus) => {
    if (!inspection) return;
    setUpdating(true);
    try {
      const res = await fetch(`${BASE}/yard/inspections/${inspection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      const updated = await res.json();
      setInspection(updated);
      Alert.alert("Updated", `Inspection marked as ${STATUS_LABEL[status]}.`);
    } catch {
      Alert.alert("Error", "Failed to update inspection.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Inspection Detail" showBack showNotifications={false} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  if (!inspection) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Inspection Detail" showBack showNotifications={false} />
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Inspection not found</Text>
        </View>
      </View>
    );
  }

  const failedLines = inspection.bodyDamage
    ? inspection.bodyDamage.replace("Failed items:\n", "").split("\n").filter(Boolean)
    : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`Inspection #${inspection.inspectionNumber}`}
        subtitle={inspection.vehicleName}
        showBack
        showNotifications={false}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: STATUS_BG[inspection.status] }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[inspection.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLOR[inspection.status] }]}>
            {STATUS_LABEL[inspection.status]}
          </Text>
          <Text style={[styles.typeBadge, { color: STATUS_COLOR[inspection.status] }]}>
            · {TYPE_LABEL[inspection.type] ?? inspection.type}
          </Text>
        </View>

        {/* Vehicle info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle</Text>
          <Text style={[styles.vehicleName, { color: colors.foreground }]}>{inspection.vehicleName}</Text>
          <Text style={[styles.stockVin, { color: colors.mutedForeground }]}>{inspection.stockVin}</Text>
          {inspection.locationName && (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.stockVin, { color: colors.mutedForeground }]}>{inspection.locationName}</Text>
            </View>
          )}
        </View>

        {/* Checklist summary */}
        {inspection.notes && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Checklist Summary</Text>
            {inspection.notes.split("\n").map((line, i) => (
              <Text key={i} style={[styles.noteLine, { color: colors.foreground }]}>{line}</Text>
            ))}
          </View>
        )}

        {/* Failed items */}
        {failedLines.length > 0 && (
          <View style={[styles.card, { backgroundColor: "#fff1f2", borderColor: "#fca5a5" }]}>
            <View style={styles.sectionHeader}>
              <Feather name="alert-triangle" size={14} color="#ef4444" />
              <Text style={[styles.sectionTitle, { color: "#ef4444", marginBottom: 0 }]}>
                Failed Items ({failedLines.length})
              </Text>
            </View>
            {failedLines.map((line, i) => (
              <View key={i} style={styles.failLine}>
                <Feather name="x-circle" size={13} color="#ef4444" />
                <Text style={[styles.failLineText, { color: "#991b1b" }]}>{line}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Fuel */}
        {inspection.fuelPercentage !== null && inspection.fuelPercentage !== undefined && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Fuel Level</Text>
            <View style={styles.fuelRow}>
              <View style={[styles.fuelBar, { backgroundColor: colors.muted, flex: 1 }]}>
                <View
                  style={[
                    styles.fuelFill,
                    {
                      width: `${inspection.fuelPercentage}%`,
                      backgroundColor:
                        inspection.fuelPercentage < 25 ? "#ef4444"
                          : inspection.fuelPercentage < 50 ? "#d97706"
                          : "#16a34a",
                    },
                  ]}
                />
              </View>
              <Text style={[styles.fuelPct, { color: colors.foreground }]}>{inspection.fuelPercentage}%</Text>
            </View>
          </View>
        )}

        {/* Dates */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timeline</Text>
          <View style={styles.dateRow}>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Created</Text>
            <Text style={[styles.dateValue, { color: colors.foreground }]}>
              {new Date(inspection.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
          {inspection.completedAt && (
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Completed</Text>
              <Text style={[styles.dateValue, { color: colors.foreground }]}>
                {new Date(inspection.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {inspection.status !== "finished" && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Actions</Text>

            {inspection.status === "queued" && (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={() => updateStatus("in-progress")}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Feather name="play" size={15} color="#fff" />
                    <Text style={styles.actionBtnText}>Start Inspection</Text>
                  </>
                )}
              </Pressable>
            )}

            {inspection.status === "in-progress" && (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#16a34a" }]}
                onPress={() => updateStatus("finished")}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Feather name="check-circle" size={15} color="#fff" />
                    <Text style={styles.actionBtnText}>Mark as Finished</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  content: { padding: 16, gap: 12 },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  typeBadge: { fontSize: 13, fontFamily: "Inter_400Regular" },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  vehicleName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  stockVin: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  noteLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  failLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 4,
  },
  failLineText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 19,
  },
  fuelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fuelBar: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  fuelFill: {
    height: "100%",
    borderRadius: 5,
  },
  fuelPct: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    minWidth: 40,
    textAlign: "right",
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  dateLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  dateValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 4,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
