import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useAuth } from "@/context/AuthContext";

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
  assignedTo?: string | null;
  assignedAt?: string | null;
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

const TECHNICIANS = [
  { code: "MR", name: "Mike Rodriguez" },
  { code: "JW", name: "James Wilson" },
  { code: "CM", name: "Carlos Mendez" },
  { code: "AH", name: "Ahmed Hassan" },
];

export default function InspectionDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAuth();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const isSupervisor = role === "supervisor";

  const load = () => {
    if (!id) return;
    fetch(`${BASE}/yard/inspections/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => {
        setInspection(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
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

  const assignTech = async (techCode: string) => {
    if (!inspection) return;
    setAssigning(true);
    setShowAssignModal(false);
    try {
      const res = await fetch(`${BASE}/yard/inspections/${inspection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: techCode }),
      });
      if (!res.ok) throw new Error("Assign failed");
      const updated = await res.json();
      setInspection(updated);
      const tech = TECHNICIANS.find((t) => t.code === techCode);
      Alert.alert(
        "Technician Assigned",
        `${tech?.name ?? techCode} has been assigned to this PDI. They will be notified on their next login.`,
      );
    } catch {
      Alert.alert("Error", "Failed to assign technician.");
    } finally {
      setAssigning(false);
    }
  };

  const unassignTech = async () => {
    if (!inspection) return;
    Alert.alert("Remove Assignment", "Remove the current technician assignment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setAssigning(true);
          try {
            const res = await fetch(`${BASE}/yard/inspections/${inspection.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assignedTo: "" }),
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            setInspection(updated);
          } catch {
            Alert.alert("Error", "Failed to remove assignment.");
          } finally {
            setAssigning(false);
          }
        },
      },
    ]);
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

  const assignedTech = TECHNICIANS.find((t) => t.code === inspection.assignedTo);

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

        {/* Assignment card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Assigned Technician</Text>

          {inspection.assignedTo ? (
            <View style={styles.assignedRow}>
              <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.techAvatarText}>{inspection.assignedTo}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.techName, { color: colors.foreground }]}>
                  {assignedTech?.name ?? inspection.assignedTo}
                </Text>
                {inspection.assignedAt && (
                  <Text style={[styles.stockVin, { color: colors.mutedForeground }]}>
                    Assigned {new Date(inspection.assignedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </Text>
                )}
              </View>
              {isSupervisor && inspection.status !== "finished" && (
                <Pressable
                  onPress={unassignTech}
                  style={[styles.smallBtn, { borderColor: "#ef4444" }]}
                  disabled={assigning}
                >
                  <Text style={{ color: "#ef4444", fontSize: 11, fontFamily: "Inter_500Medium" }}>Remove</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.unassignedRow}>
              <Feather name="user-x" size={16} color={colors.mutedForeground} />
              <Text style={[styles.stockVin, { color: colors.mutedForeground, flex: 1 }]}>
                No technician assigned yet
              </Text>
              {isSupervisor && inspection.status !== "finished" && (
                <Pressable
                  style={[styles.smallBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setShowAssignModal(true)}
                  disabled={assigning}
                >
                  {assigning
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Assign Tech</Text>
                  }
                </Pressable>
              )}
            </View>
          )}

          {isSupervisor && inspection.assignedTo && inspection.status !== "finished" && (
            <Pressable
              style={[styles.reassignBtn, { borderColor: colors.primary }]}
              onPress={() => setShowAssignModal(true)}
              disabled={assigning}
            >
              <Feather name="user-check" size={13} color={colors.primary} />
              <Text style={[styles.reassignText, { color: colors.primary }]}>Reassign Tech</Text>
            </Pressable>
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

        {/* Completed summary banner */}
        {inspection.status === "finished" && (
          <View style={[styles.card, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
            <View style={styles.sectionHeader}>
              <Feather name="check-circle" size={14} color="#16a34a" />
              <Text style={[styles.sectionTitle, { color: "#16a34a", marginBottom: 0 }]}>
                Inspection Complete
              </Text>
            </View>
            <Text style={[styles.noteLine, { color: "#166534" }]}>
              This inspection was completed on{" "}
              {inspection.completedAt
                ? new Date(inspection.completedAt).toLocaleDateString("en-GB", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })
                : "—"}
              {failedLines.length === 0 ? " with no failed items." : ` with ${failedLines.length} failed item${failedLines.length !== 1 ? "s" : ""} noted.`}
            </Text>
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
          {inspection.assignedAt && (
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Assigned</Text>
              <Text style={[styles.dateValue, { color: colors.foreground }]}>
                {new Date(inspection.assignedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          )}
          {inspection.completedAt && (
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Completed</Text>
              <Text style={[styles.dateValue, { color: colors.foreground }]}>
                {new Date(inspection.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          )}
        </View>

        {/* Actions for technicians / supervisors */}
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

      {/* Assign Tech Modal */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAssignModal(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Assign Technician</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              The assigned tech will be notified on their next login
            </Text>
            {TECHNICIANS.map((tech) => (
              <Pressable
                key={tech.code}
                style={[
                  styles.techRow,
                  { borderColor: colors.border },
                  inspection.assignedTo === tech.code && { backgroundColor: "#eff6ff", borderColor: "#1d4ed8" },
                ]}
                onPress={() => assignTech(tech.code)}
              >
                <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.techAvatarText}>{tech.code}</Text>
                </View>
                <Text style={[styles.techName, { color: colors.foreground, flex: 1 }]}>{tech.name}</Text>
                {inspection.assignedTo === tech.code && (
                  <Feather name="check" size={16} color="#1d4ed8" />
                )}
              </Pressable>
            ))}
            <Pressable
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowAssignModal(false)}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  assignedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  unassignedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  techAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  techAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  techName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  reassignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  reassignText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingTop: 12,
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  modalSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
    marginBottom: 4,
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
