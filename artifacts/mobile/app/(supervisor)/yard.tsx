import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";

const BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

type VehicleStatus = "available" | "in_transit" | "pdi_pending" | "sold";
type InspectionStatus = "queued" | "in-progress" | "finished";
type Urgency = "overdue" | "due-soon" | "ok";
type PeriodicType = "periodic-fluid" | "periodic-damage" | "start-and-run";

interface YardVehicle {
  id: number;
  stockNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin: string;
  status: VehicleStatus;
  locationName?: string;
  spotCode?: string;
  mileage?: number;
  price?: number | null;
  inspectionIntervalDays?: number;
}

interface YardInspection {
  id: number;
  inspectionNumber: string;
  vehicleName: string;
  vehicleYear?: number | null;
  stockVin: string;
  status: InspectionStatus;
  type: string;
  locationName?: string;
  createdAt: string;
  completedAt?: string;
  assignedTo?: string | null;
}

interface InspectionRec {
  vehicleId: number;
  vehicleName: string;
  stockNumber: string;
  urgency: Urgency;
  daysRemaining: number;
  daysSinceArrival: number;
  lastInspectedAt: string | null;
  nextDueDate: string;
  aiRecommendation: string;
}

type Tab = "vehicles" | "inspections";

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

const PERIODIC_TYPES: Array<{ value: PeriodicType; label: string }> = [
  { value: "periodic-fluid", label: "Fluid Check" },
  { value: "periodic-damage", label: "Damage Scan" },
  { value: "start-and-run", label: "Start & Run" },
];

const STATUS_LABEL: Record<VehicleStatus, string> = {
  available: "Available",
  in_transit: "In Transit",
  pdi_pending: "PDI Pending",
  sold: "Sold",
};
const STATUS_COLOR: Record<VehicleStatus, string> = {
  available: "#16a34a",
  in_transit: "#d97706",
  pdi_pending: "#1d4ed8",
  sold: "#64748b",
};
const STATUS_BG: Record<VehicleStatus, string> = {
  available: "#dcfce7",
  in_transit: "#fef3c7",
  pdi_pending: "#dbeafe",
  sold: "#f1f5f9",
};

const INSP_LABEL: Record<InspectionStatus, string> = {
  queued: "Queued",
  "in-progress": "In Progress",
  finished: "Finished",
};
const INSP_COLOR: Record<InspectionStatus, string> = {
  queued: "#d97706",
  "in-progress": "#1d4ed8",
  finished: "#16a34a",
};
const INSP_BG: Record<InspectionStatus, string> = {
  queued: "#fef3c7",
  "in-progress": "#dbeafe",
  finished: "#dcfce7",
};

const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "#dc2626",
  "due-soon": "#d97706",
  ok: "#16a34a",
};
const URGENCY_BG: Record<Urgency, string> = {
  overdue: "#fef2f2",
  "due-soon": "#fef3c7",
  ok: "#dcfce7",
};

async function fetchJson(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function InspectionBadge({ rec }: { rec: InspectionRec }) {
  const label =
    rec.urgency === "overdue"
      ? `Overdue ${Math.abs(rec.daysRemaining)}d`
      : rec.urgency === "due-soon"
      ? `Due in ${rec.daysRemaining}d`
      : `PDI in ${rec.daysRemaining}d`;

  return (
    <View style={[styles.inspBadge, { backgroundColor: URGENCY_BG[rec.urgency] }]}>
      <Feather
        name={rec.urgency === "overdue" ? "alert-circle" : rec.urgency === "due-soon" ? "clock" : "check-circle"}
        size={10}
        color={URGENCY_COLOR[rec.urgency]}
      />
      <Text style={[styles.inspBadgeText, { color: URGENCY_COLOR[rec.urgency] }]}>{label}</Text>
    </View>
  );
}

interface GenerateSheetProps {
  visible: boolean;
  onClose: () => void;
  onGenerated: (created: number, assigned: number) => void;
  recommendations: InspectionRec[];
}

function GenerateSheet({ visible, onClose, onGenerated, recommendations }: GenerateSheetProps) {
  const colors = useColors();
  const [intervalDays, setIntervalDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [autoAssign, setAutoAssign] = useState(true);
  const [inspType, setInspType] = useState<PeriodicType>("periodic-fluid");
  const [generating, setGenerating] = useState(false);
  const [availTechs, setAvailTechs] = useState<{ name: string; status: string }[]>([]);

  const effectiveInterval = isCustom ? Number(customDays) || 0 : intervalDays;

  useEffect(() => {
    if (!visible) return;
    fetch(`${BASE}/yard/inspections/available-techs`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAvailTechs(data.techs ?? []); })
      .catch(() => {});
  }, [visible]);

  const previewRecs = recommendations.filter(
    (r) => r.daysRemaining <= effectiveInterval || r.urgency === "overdue"
  );

  const handleGenerate = async () => {
    if (effectiveInterval < 1) return;
    setGenerating(true);
    try {
      const res = await fetch(`${BASE}/yard/inspections/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intervalDays: effectiveInterval,
          autoAssign,
          inspectionType: inspType,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      onGenerated(data.created ?? 0, data.assigned ?? 0);
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalSheet, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Schedule Inspections</Text>
          <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
            Generate periodic inspections for vehicles overdue or due within the selected interval
          </Text>

          {/* Interval picker */}
          <View style={styles.sheetSection}>
            <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Inspection Interval</Text>
            <View style={styles.chipRow}>
              {[30, 60, 90].map((d) => (
                <Pressable
                  key={d}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: !isCustom && intervalDays === d ? colors.primary : colors.background,
                      borderColor: !isCustom && intervalDays === d ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setIntervalDays(d); setIsCustom(false); }}
                >
                  <Text style={[styles.chipText, { color: !isCustom && intervalDays === d ? "#fff" : colors.foreground }]}>
                    {d} days
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={[
                  styles.chip,
                  {
                    backgroundColor: isCustom ? colors.primary : colors.background,
                    borderColor: isCustom ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setIsCustom(true)}
              >
                <Text style={[styles.chipText, { color: isCustom ? "#fff" : colors.foreground }]}>Custom</Text>
              </Pressable>
            </View>
            {isCustom && (
              <TextInput
                value={customDays}
                onChangeText={setCustomDays}
                keyboardType="number-pad"
                placeholder="Enter days..."
                placeholderTextColor={colors.mutedForeground}
                style={[styles.customInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            )}
          </View>

          {/* Inspection type */}
          <View style={styles.sheetSection}>
            <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Inspection Type</Text>
            <View style={styles.chipRow}>
              {PERIODIC_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: inspType === t.value ? colors.primary : colors.background,
                      borderColor: inspType === t.value ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setInspType(t.value)}
                >
                  <Text style={[styles.chipText, { color: inspType === t.value ? "#fff" : colors.foreground }]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Auto-assign toggle */}
          <View style={styles.sheetSection}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetLabel, { color: colors.foreground }]}>Auto-Assign</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground, marginTop: 2 }]}>
                  Distribute evenly across available technicians
                </Text>
              </View>
              <Switch
                value={autoAssign}
                onValueChange={setAutoAssign}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
            {autoAssign && (
              availTechs.length === 0 ? (
                <View style={[styles.availWarn, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
                  <Feather name="alert-triangle" size={12} color="#dc2626" />
                  <Text style={[styles.availWarnText, { color: "#dc2626" }]}>
                    No techs available — all on break or absent. Inspections will be unassigned.
                  </Text>
                </View>
              ) : (
                <View style={[styles.availInfo, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                  <Feather name="users" size={12} color="#16a34a" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.availInfoText, { color: "#16a34a" }]}>
                      {availTechs.length} tech{availTechs.length !== 1 ? "s" : ""} available — round-robin
                    </Text>
                    <Text style={[styles.availNames, { color: "#15803d" }]}>
                      {availTechs.map((t) => t.name.split(" ")[0]).join(", ")}
                    </Text>
                  </View>
                </View>
              )
            )}
          </View>

          {/* Preview */}
          {effectiveInterval > 0 && (
            <View style={styles.sheetSection}>
              <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>
                Preview — {previewRecs.length} vehicle{previewRecs.length !== 1 ? "s" : ""} would be included
              </Text>
              {previewRecs.length === 0 ? (
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  No vehicles are overdue or due within {effectiveInterval} days
                </Text>
              ) : (
                <ScrollView style={styles.previewList} nestedScrollEnabled>
                  {previewRecs.slice(0, 10).map((r) => (
                    <View key={r.vehicleId} style={[styles.previewRow, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.previewVehicle, { color: colors.foreground }]} numberOfLines={1}>
                          {r.vehicleName}
                        </Text>
                        <Text style={[styles.previewSub, { color: colors.mutedForeground }]}>
                          {r.stockNumber} · {r.daysSinceArrival}d in yard
                        </Text>
                      </View>
                      <View style={[styles.urgencyBadge, { backgroundColor: URGENCY_BG[r.urgency] }]}>
                        <Text style={[styles.urgencyText, { color: URGENCY_COLOR[r.urgency] }]}>
                          {r.urgency === "overdue"
                            ? `${Math.abs(r.daysRemaining)}d overdue`
                            : r.urgency === "due-soon"
                            ? `Due in ${r.daysRemaining}d`
                            : "On Schedule"}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {previewRecs.length > 10 && (
                    <Text style={[styles.previewMore, { color: colors.mutedForeground }]}>
                      +{previewRecs.length - 10} more
                    </Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.generateBtn,
                {
                  backgroundColor: previewRecs.length === 0 || generating ? colors.muted : colors.primary,
                  opacity: previewRecs.length === 0 || generating || effectiveInterval < 1 ? 0.5 : 1,
                },
              ]}
              onPress={handleGenerate}
              disabled={previewRecs.length === 0 || generating || effectiveInterval < 1}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="zap" size={14} color="#fff" />
                  <Text style={styles.generateText}>
                    Generate {previewRecs.length > 0 ? `(${previewRecs.length})` : ""}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SupervisorYardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [tab, setTab] = useState<Tab>("vehicles");
  const [vehicles, setVehicles] = useState<YardVehicle[]>([]);
  const [inspections, setInspections] = useState<YardInspection[]>([]);
  const [recommendations, setRecommendations] = useState<Record<number, InspectionRec>>({});
  const [allRecommendations, setAllRecommendations] = useState<InspectionRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");
  const [inspFilter, setInspFilter] = useState<InspectionStatus | "all">("all");
  const [showGenerateSheet, setShowGenerateSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadVehicles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const data = await fetchJson(`/yard/vehicles?${params}`);
      setVehicles(data.vehicles ?? []);
    } catch {
      setVehicles([]);
    }
  }, [search, statusFilter]);

  const loadRecommendations = useCallback(async () => {
    try {
      const data = await fetchJson("/yard/inspection-recommendations");
      const all: InspectionRec[] = data.recommendations ?? [];
      const map: Record<number, InspectionRec> = {};
      for (const r of all) {
        map[r.vehicleId] = r;
      }
      setRecommendations(map);
      setAllRecommendations(all);
    } catch {
      // non-critical
    }
  }, []);

  const loadInspections = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (inspFilter !== "all") params.set("status", inspFilter);
      const data = await fetchJson(`/yard/inspections?${params}`);
      setInspections(data.inspections ?? []);
    } catch {
      setInspections([]);
    }
  }, [inspFilter]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    await Promise.all([loadVehicles(), loadInspections(), loadRecommendations()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadVehicles, loadInspections, loadRecommendations]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => load(true);

  const VEHICLE_FILTERS: Array<{ label: string; value: VehicleStatus | "all" }> = [
    { label: "All", value: "all" },
    { label: "Available", value: "available" },
    { label: "In Transit", value: "in_transit" },
    { label: "PDI Pending", value: "pdi_pending" },
    { label: "Sold", value: "sold" },
  ];
  const INSP_FILTERS: Array<{ label: string; value: InspectionStatus | "all" }> = [
    { label: "All", value: "all" },
    { label: "Queued", value: "queued" },
    { label: "In Progress", value: "in-progress" },
    { label: "Finished", value: "finished" },
  ];

  const filteredVehicles = vehicles.filter((v) => {
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.stockNumber.toLowerCase().includes(q) ||
        v.vin.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredInspections = inspections.filter((i) => {
    if (inspFilter !== "all" && i.status !== inspFilter) return false;
    return true;
  });

  const overdueCount = Object.values(recommendations).filter((r) => r.urgency === "overdue").length;
  const dueSoonCount = Object.values(recommendations).filter((r) => r.urgency === "due-soon").length;

  const pendingAssignment = inspections.filter(
    (i) => i.status === "queued" && !i.assignedTo,
  ).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Yard" subtitle="Supervisor View" showNotifications={false} />

      {/* Toast notification */}
      {toast && (
        <View style={styles.toast}>
          <Feather name="check-circle" size={14} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Inspection alert banner */}
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <View style={[
          styles.alertBanner,
          { backgroundColor: overdueCount > 0 ? "#fef2f2" : "#fef3c7",
            borderBottomColor: overdueCount > 0 ? "#fca5a5" : "#fde68a" },
        ]}>
          <Feather
            name="alert-triangle"
            size={14}
            color={overdueCount > 0 ? "#dc2626" : "#d97706"}
          />
          <Text style={[styles.alertText, { color: overdueCount > 0 ? "#dc2626" : "#d97706" }]}>
            {overdueCount > 0
              ? `${overdueCount} vehicle${overdueCount !== 1 ? "s" : ""} overdue for inspection${dueSoonCount > 0 ? `, ${dueSoonCount} due soon` : ""}`
              : `${dueSoonCount} vehicle${dueSoonCount !== 1 ? "s" : ""} due for inspection soon`}
          </Text>
        </View>
      )}

      {/* Unassigned PDI banner for supervisor */}
      {pendingAssignment > 0 && tab === "inspections" && (
        <View style={[styles.alertBanner, { backgroundColor: "#eff6ff", borderBottomColor: "#bfdbfe" }]}>
          <Feather name="user-x" size={14} color="#1d4ed8" />
          <Text style={[styles.alertText, { color: "#1d4ed8" }]}>
            {pendingAssignment} queued PDI{pendingAssignment !== 1 ? "s" : ""} not yet assigned to a technician
          </Text>
        </View>
      )}

      {/* Tab switcher */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["vehicles", "inspections"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "vehicles" ? "Inventory" : "Inspections"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : tab === "vehicles" ? (
        <View style={{ flex: 1 }}>
          {/* Search */}
          <View style={[styles.searchRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search make, model, stock #, VIN…"
                placeholderTextColor={colors.mutedForeground}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Status filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.filterScroll, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
            contentContainerStyle={styles.filterContent}
          >
            {VEHICLE_FILTERS.map((f) => (
              <Pressable
                key={f.value}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: statusFilter === f.value ? colors.primary : colors.background,
                    borderColor: statusFilter === f.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setStatusFilter(f.value)}
              >
                <Text style={[styles.filterChipText, { color: statusFilter === f.value ? "#fff" : colors.foreground }]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <FlatList
            data={filteredVehicles}
            keyExtractor={(v) => String(v.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 16 }]}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="truck" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No vehicles found</Text>
              </View>
            }
            renderItem={({ item: v }) => {
              const rec = recommendations[v.id];
              return (
                <Pressable
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push({ pathname: "/yard/vehicle", params: { id: String(v.id) } })}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardLeft}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                        {v.year} {v.make} {v.model}
                      </Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                        Stock #{v.stockNumber} · {v.color}
                      </Text>
                      <Text style={[styles.cardVin, { color: colors.mutedForeground }]} numberOfLines={1}>
                        VIN: {v.vin}
                      </Text>
                      {v.locationName && (
                        <View style={styles.locationRow}>
                          <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                            {v.locationName}{v.spotCode ? ` · ${v.spotCode}` : ""}
                          </Text>
                        </View>
                      )}
                      {/* Price — always visible to supervisors */}
                      {v.price != null && (
                        <Text style={[styles.priceText, { color: colors.primary }]}>
                          QAR {Number(v.price).toLocaleString()}
                        </Text>
                      )}
                      {/* Inspection recommendation badge */}
                      {rec && v.status !== "sold" && <InspectionBadge rec={rec} />}
                    </View>
                    <View style={styles.cardRight}>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[v.status] }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLOR[v.status] }]}>
                          {STATUS_LABEL[v.status]}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginTop: 8 }} />
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Inspection filters + Generate button */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.filterScroll, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
            contentContainerStyle={styles.filterContent}
          >
            {INSP_FILTERS.map((f) => (
              <Pressable
                key={f.value}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: inspFilter === f.value ? colors.primary : colors.background,
                    borderColor: inspFilter === f.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setInspFilter(f.value)}
              >
                <Text style={[styles.filterChipText, { color: inspFilter === f.value ? "#fff" : colors.foreground }]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}

            {/* Generate button */}
            <Pressable
              style={[styles.filterChip, styles.generateChip, { backgroundColor: "#7c3aed", borderColor: "#7c3aed" }]}
              onPress={() => setShowGenerateSheet(true)}
            >
              <Feather name="zap" size={13} color="#fff" />
              <Text style={[styles.filterChipText, { color: "#fff" }]}>Generate</Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, styles.createBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => router.push("/yard/new-inspection")}
            >
              <Feather name="plus" size={13} color="#fff" />
              <Text style={[styles.filterChipText, { color: "#fff" }]}>New PDI</Text>
            </Pressable>
          </ScrollView>

          <FlatList
            data={filteredInspections}
            keyExtractor={(i) => String(i.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 16 }]}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="clipboard" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No inspections found</Text>
              </View>
            }
            renderItem={({ item: insp }) => (
              <Pressable
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  insp.status === "queued" && !insp.assignedTo && styles.unassignedCard,
                ]}
                onPress={() => router.push({ pathname: "/yard/inspection", params: { id: String(insp.id) } })}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <View style={styles.inspTopRow}>
                      <Text style={[styles.inspNum, { color: colors.primary }]}>#{insp.inspectionNumber}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: INSP_BG[insp.status] }]}>
                        <Text style={[styles.statusText, { color: INSP_COLOR[insp.status] }]}>
                          {INSP_LABEL[insp.status]}
                        </Text>
                      </View>
                      {insp.status === "queued" && !insp.assignedTo && (
                        <View style={[styles.statusBadge, { backgroundColor: "#eff6ff" }]}>
                          <Text style={[styles.statusText, { color: "#1d4ed8" }]}>Unassigned</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{insp.vehicleName}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                      {TYPE_LABELS[insp.type] ?? insp.type}
                    </Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>{insp.stockVin}</Text>
                    {insp.assignedTo && (
                      <View style={styles.assignedRow}>
                        <Feather name="user" size={11} color="#16a34a" />
                        <Text style={[styles.cardSub, { color: "#16a34a" }]}>Tech: {insp.assignedTo}</Text>
                      </View>
                    )}
                    {insp.locationName && (
                      <View style={styles.locationRow}>
                        <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{insp.locationName}</Text>
                      </View>
                    )}
                    <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
                      {new Date(insp.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {insp.completedAt ? ` · Done ${new Date(insp.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </View>
              </Pressable>
            )}
          />
        </View>
      )}

      <GenerateSheet
        visible={showGenerateSheet}
        onClose={() => setShowGenerateSheet(false)}
        recommendations={allRecommendations}
        onGenerated={(created, assigned) => {
          const msg = `${created} inspection${created !== 1 ? "s" : ""} created${assigned > 0 ? `, ${assigned} auto-assigned` : ""}`;
          showToast(msg);
          load(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toast: {
    position: "absolute",
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  alertText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  filterScroll: {
    borderBottomWidth: 1,
    flexGrow: 0,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  generateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 2,
  },
  unassignedCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#1d4ed8",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardLeft: { flex: 1, gap: 3 },
  cardRight: { alignItems: "flex-end" },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  cardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  cardVin: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  cardDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  assignedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  priceText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  inspBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  inspBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  inspTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
    flexWrap: "wrap",
  },
  inspNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    gap: 0,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  sheetSection: {
    marginTop: 16,
  },
  sheetLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  customInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  availWarn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  availWarnText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 16,
  },
  availInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  availInfoText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  availNames: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  previewList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    marginTop: 4,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewVehicle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  previewSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  urgencyText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  previewMore: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    padding: 8,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    paddingBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  generateBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  generateText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
