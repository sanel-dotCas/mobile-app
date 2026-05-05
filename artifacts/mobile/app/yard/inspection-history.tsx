import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

type InspectionStatus = "queued" | "in-progress" | "finished";
type ChecklistResult = "pass" | "fail" | "attention" | "na" | "pending";

interface ChecklistItem {
  label: string;
  result: ChecklistResult;
  note: string;
}
interface ChecklistSection {
  section: string;
  items: ChecklistItem[];
}

interface Inspection {
  id: number;
  inspectionNumber: string;
  vehicleName: string;
  type: string;
  status: InspectionStatus;
  assignedTo: string | null;
  createdAt: string;
  completedAt: string | null;
  notes: string | null;
  bodyDamage: string | null;
  checklist: string | null;
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
const STATUS_LABEL: Record<InspectionStatus, string> = {
  queued: "Queued",
  "in-progress": "In Progress",
  finished: "Finished",
};

const RESULT_COLOR: Record<ChecklistResult, string> = {
  pass: "#16a34a",
  fail: "#dc2626",
  attention: "#d97706",
  na: "#94a3b8",
  pending: "#94a3b8",
};
const RESULT_BG: Record<ChecklistResult, string> = {
  pass: "#dcfce7",
  fail: "#fef2f2",
  attention: "#fef3c7",
  na: "#f1f5f9",
  pending: "#f1f5f9",
};
const RESULT_LABEL: Record<ChecklistResult, string> = {
  pass: "Pass",
  fail: "Fail",
  attention: "Attention",
  na: "N/A",
  pending: "Pending",
};
const RESULT_ICON: Record<ChecklistResult, React.ComponentProps<typeof Feather>["name"]> = {
  pass: "check-circle",
  fail: "x-circle",
  attention: "alert-circle",
  na: "minus-circle",
  pending: "circle",
};

function parseChecklist(raw: string | null): ChecklistSection[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ChecklistSection[];
  } catch { /* fall through */ }
  return [];
}

function getFailedItems(sections: ChecklistSection[]): Array<{ section: string; label: string }> {
  const failed: Array<{ section: string; label: string }> = [];
  for (const s of sections) {
    for (const item of s.items) {
      if (item.result === "fail") {
        failed.push({ section: s.section, label: item.label });
      }
    }
  }
  return failed;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface InspectionCardProps {
  insp: Inspection;
  isSupervisor: boolean;
  onCreateRO: (insp: Inspection, failedItems: Array<{ section: string; label: string }>) => void;
}

function InspectionCard({ insp, isSupervisor, onCreateRO }: InspectionCardProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const sections = parseChecklist(insp.checklist);
  const failedItems = getFailedItems(sections);
  const hasChecklist = sections.length > 0;
  const hasFailures = failedItems.length > 0;

  // Summary counts
  const allItems = sections.flatMap((s) => s.items);
  const passCount = allItems.filter((i) => i.result === "pass").length;
  const failCount = allItems.filter((i) => i.result === "fail").length;
  const attCount = allItems.filter((i) => i.result === "attention").length;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: hasFailures && insp.status === "finished" ? "#fca5a5" : colors.border }]}>
      {/* Card header */}
      <Pressable onPress={() => hasChecklist && setExpanded((e) => !e)} style={styles.cardHeader}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.inspNumber, { color: colors.foreground }]}>
              #{insp.inspectionNumber}
            </Text>
            <View style={[styles.badge, { backgroundColor: STATUS_BG[insp.status] }]}>
              <Text style={[styles.badgeText, { color: STATUS_COLOR[insp.status] }]}>
                {STATUS_LABEL[insp.status]}
              </Text>
            </View>
            {hasFailures && insp.status === "finished" && (
              <View style={[styles.badge, { backgroundColor: "#fef2f2" }]}>
                <Feather name="alert-circle" size={10} color="#dc2626" />
                <Text style={[styles.badgeText, { color: "#dc2626" }]}>{failCount} Failed</Text>
              </View>
            )}
          </View>
          <View style={styles.cardMeta}>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {TYPE_LABELS[insp.type] ?? insp.type}
            </Text>
            <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {formatDate(insp.createdAt)}
            </Text>
            {insp.assignedTo && (
              <>
                <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>·</Text>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {insp.assignedTo}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Checklist summary row */}
        {hasChecklist && (
          <View style={styles.summaryRow}>
            {passCount > 0 && (
              <View style={[styles.summaryChip, { backgroundColor: "#dcfce7" }]}>
                <Feather name="check" size={11} color="#16a34a" />
                <Text style={[styles.summaryChipText, { color: "#16a34a" }]}>{passCount} Pass</Text>
              </View>
            )}
            {failCount > 0 && (
              <View style={[styles.summaryChip, { backgroundColor: "#fef2f2" }]}>
                <Feather name="x" size={11} color="#dc2626" />
                <Text style={[styles.summaryChipText, { color: "#dc2626" }]}>{failCount} Fail</Text>
              </View>
            )}
            {attCount > 0 && (
              <View style={[styles.summaryChip, { backgroundColor: "#fef3c7" }]}>
                <Feather name="alert-triangle" size={11} color="#d97706" />
                <Text style={[styles.summaryChipText, { color: "#d97706" }]}>{attCount} Attention</Text>
              </View>
            )}
            <View style={styles.expandHint}>
              <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
            </View>
          </View>
        )}
      </Pressable>

      {/* Expanded checklist */}
      {expanded && hasChecklist && (
        <View style={[styles.checklistBody, { borderTopColor: colors.border }]}>
          {sections.map((section) => (
            <View key={section.section} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {section.section}
              </Text>
              {section.items.map((item) => (
                <View key={item.label} style={[styles.checkItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.checkItemLeft}>
                    <Feather
                      name={RESULT_ICON[item.result]}
                      size={15}
                      color={RESULT_COLOR[item.result]}
                    />
                    <Text style={[styles.checkItemLabel, { color: colors.foreground }]}>
                      {item.label}
                    </Text>
                  </View>
                  <View style={[styles.resultChip, { backgroundColor: RESULT_BG[item.result] }]}>
                    <Text style={[styles.resultChipText, { color: RESULT_COLOR[item.result] }]}>
                      {RESULT_LABEL[item.result]}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}

          {/* Notes */}
          {insp.notes && (
            <View style={[styles.notesBox, { backgroundColor: colors.accent, borderColor: colors.border }]}>
              <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>Notes</Text>
              <Text style={[styles.notesText, { color: colors.foreground }]}>{insp.notes}</Text>
            </View>
          )}
          {insp.bodyDamage && (
            <View style={[styles.notesBox, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
              <Text style={[styles.notesLabel, { color: "#92400e" }]}>Body Damage</Text>
              <Text style={[styles.notesText, { color: "#92400e" }]}>{insp.bodyDamage}</Text>
            </View>
          )}

          {/* Create RO button for supervisors with failed items */}
          {isSupervisor && hasFailures && insp.status === "finished" && (
            <Pressable
              style={styles.createROBtn}
              onPress={() => onCreateRO(insp, failedItems)}
            >
              <Feather name="tool" size={15} color="#fff" />
              <Text style={styles.createROBtnText}>Create Repair Order from Failed Items</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export default function InspectionHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, vehicleName } = useLocalSearchParams<{ id: string; vehicleName: string }>();
  const { role } = useAuth();
  const router = useRouter();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isSupervisor = role === "supervisor" || role === "admin";

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ vehicleId: id, limit: "50" });
      const res = await fetch(`${BASE}/yard/inspections?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInspections(data.inspections ?? []);
    } catch {
      setInspections([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleCreateRO = (
    insp: Inspection,
    failedItems: Array<{ section: string; label: string }>
  ) => {
    const itemList = failedItems.map((f) => `• ${f.section}: ${f.label}`).join("\n");
    Alert.alert(
      "Create Repair Order",
      `This will create a repair order for ${failedItems.length} failed item${failedItems.length !== 1 ? "s" : ""} from inspection #${insp.inspectionNumber}:\n\n${itemList}\n\nProceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create RO",
          style: "default",
          onPress: () => submitCreateRO(insp, failedItems),
        },
      ]
    );
  };

  const submitCreateRO = async (
    insp: Inspection,
    failedItems: Array<{ section: string; label: string }>
  ) => {
    setCreating(true);
    try {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand = Math.floor(Math.random() * 900 + 100);
      const estimateNumber = `RO-${today}-${rand}`;

      const tasks = failedItems.map((f, idx) => ({
        id: `task-ro-${Date.now()}-${idx}`,
        title: f.label,
        type: "Repair",
        laborType: "MECHANICAL",
        status: "pending",
        estimatedHours: 0,
        workedHours: 0,
        description: `Failed during ${TYPE_LABELS[insp.type] ?? insp.type} (${f.section}) — Inspection #${insp.inspectionNumber}`,
        technician: "",
        notes: [],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 0,
        parts: [],
      }));

      const res = await fetch(`${BASE}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateNumber,
          vehicle: insp.vehicleName,
          customerNotes: `Repair order created from inspection #${insp.inspectionNumber} — ${failedItems.length} failed items`,
          tasks,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();

      Alert.alert(
        "Repair Order Created",
        `Repair order ${estimateNumber} has been created with ${failedItems.length} task${failedItems.length !== 1 ? "s" : ""}.`,
        [
          { text: "Stay Here", style: "cancel" },
          {
            text: "View Job",
            onPress: () => router.push({ pathname: "/job/[id]", params: { id: created.id } }),
          },
        ]
      );
    } catch {
      Alert.alert("Error", "Failed to create repair order. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const displayName = vehicleName ? decodeURIComponent(vehicleName) : "Vehicle";

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Inspection History" subtitle={displayName} showBack showNotifications={false} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Inspection History"
        subtitle={displayName}
        showBack
        showNotifications={false}
      />

      {creating && (
        <View style={styles.creatingBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.creatingText}>Creating repair order…</Text>
        </View>
      )}

      {inspections.length === 0 ? (
        <View style={styles.center}>
          <Feather name="clipboard" size={44} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Inspections Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            This vehicle has no inspection records.
          </Text>
        </View>
      ) : (
        <FlatList
          data={inspections}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          ListHeaderComponent={
            <Text style={[styles.countLabel, { color: colors.mutedForeground }]}>
              {inspections.length} inspection{inspections.length !== 1 ? "s" : ""} on record
            </Text>
          }
          renderItem={({ item }) => (
            <InspectionCard
              insp={item}
              isSupervisor={isSupervisor}
              onCreateRO={handleCreateRO}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  list: { padding: 16 },
  countLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
    textAlign: "right",
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  creatingBanner: {
    backgroundColor: "#1d4ed8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  creatingText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },

  // Card
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    padding: 14,
    gap: 8,
  },
  cardTop: { gap: 4 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  inspNumber: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metaDot: { fontSize: 12 },

  // Checklist summary
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  summaryChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  expandHint: { marginLeft: "auto" as const },

  // Expanded body
  checklistBody: {
    borderTopWidth: 1,
    padding: 14,
    gap: 12,
  },
  section: { gap: 6 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  checkItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  checkItemLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  resultChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resultChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  // Notes
  notesBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  notesLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  notesText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  // Create RO button
  createROBtn: {
    backgroundColor: "#1d4ed8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  createROBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
