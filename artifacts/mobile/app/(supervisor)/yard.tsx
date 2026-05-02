import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
}

interface YardInspection {
  id: number;
  inspectionNumber: string;
  vehicleName: string;
  stockVin: string;
  status: InspectionStatus;
  type: string;
  locationName?: string;
  createdAt: string;
  completedAt?: string;
}

type Tab = "vehicles" | "inspections";

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

async function fetchJson(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function YardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [tab, setTab] = useState<Tab>("vehicles");
  const [vehicles, setVehicles] = useState<YardVehicle[]>([]);
  const [inspections, setInspections] = useState<YardInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");
  const [inspFilter, setInspFilter] = useState<InspectionStatus | "all">("all");

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
    await Promise.all([loadVehicles(), loadInspections()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadVehicles, loadInspections]);

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Yard" subtitle="Vehicle Yard Management" showNotifications={false} />

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
            renderItem={({ item: v }) => (
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
            )}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Inspection filters */}
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
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
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
                    </View>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{insp.vehicleName}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>{insp.stockVin}</Text>
                    {insp.locationName && (
                      <View style={styles.locationRow}>
                        <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{insp.locationName}</Text>
                      </View>
                    )}
                    <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
                      {new Date(insp.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
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
    gap: 8,
    marginBottom: 2,
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
});
