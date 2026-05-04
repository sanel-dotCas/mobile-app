import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

type Tab = "vehicles" | "inspections" | "jobs";

interface Vehicle {
  id: number; stockNumber: string; vin: string; make: string; model: string;
  year: number; status: string; locationName: string | null;
}
interface Inspection {
  id: number; inspectionNumber: string; vehicleName: string; status: string;
  assignedTo: string | null; createdAt: string;
}
interface Job {
  id: string; estimateNumber: string; vehicleName: string; status: string;
  technicianName: string | null; createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available: { bg: "#dcfce7", text: "#16a34a" },
  in_transit: { bg: "#fef3c7", text: "#d97706" },
  pdi_pending: { bg: "#dbeafe", text: "#1d4ed8" },
  sold: { bg: "#f1f5f9", text: "#64748b" },
  queued: { bg: "#dbeafe", text: "#1d4ed8" },
  "in-progress": { bg: "#fef3c7", text: "#d97706" },
  in_progress: { bg: "#fef3c7", text: "#d97706" },
  completed: { bg: "#dcfce7", text: "#16a34a" },
  passed: { bg: "#dcfce7", text: "#16a34a" },
  failed: { bg: "#fee2e2", text: "#dc2626" },
  on_hold: { bg: "#f1f5f9", text: "#64748b" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#f1f5f9", text: "#64748b" };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{status.replace(/_/g, " ").replace(/-/g, " ")}</Text>
    </View>
  );
}

export default function AdminMonitorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("vehicles");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [vRes, iRes, jRes] = await Promise.all([
        fetch(`${BASE}/admin/monitor/vehicles`),
        fetch(`${BASE}/admin/monitor/inspections`),
        fetch(`${BASE}/admin/monitor/jobs`),
      ]);
      if (vRes.ok) { const d = await vRes.json(); setVehicles(d.vehicles ?? d); }
      if (iRes.ok) { const d = await iRes.json(); setInspections(d.inspections ?? d); }
      if (jRes.ok) { const d = await jRes.json(); setJobs(d.jobs ?? d); }
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const tabs: { key: Tab; label: string; count: number; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
    { key: "vehicles", label: "Vehicles", count: vehicles.length, icon: "truck" },
    { key: "inspections", label: "Inspections", count: inspections.length, icon: "clipboard" },
    { key: "jobs", label: "Jobs", count: jobs.length, icon: "briefcase" },
  ];

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="System Monitor" subtitle="Live data overview" />

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {tabs.map(t => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && { borderBottomColor: "#dc2626", borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
          >
            <Feather name={t.icon} size={14} color={tab === t.key ? "#dc2626" : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: tab === t.key ? "#dc2626" : colors.mutedForeground }]}>
              {t.label}
            </Text>
            <View style={[styles.tabCount, { backgroundColor: tab === t.key ? "#fee2e2" : colors.muted }]}>
              <Text style={{ fontSize: 10, color: tab === t.key ? "#dc2626" : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }}>
                {t.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
        ) : tab === "vehicles" ? (
          vehicles.length === 0 ? <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No vehicles.</Text> :
          vehicles.map(v => (
            <View key={v.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{v.year} {v.make} {v.model}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>#{v.stockNumber} · {v.locationName ?? "No location"}</Text>
              </View>
              <StatusBadge status={v.status} />
            </View>
          ))
        ) : tab === "inspections" ? (
          inspections.length === 0 ? <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No inspections.</Text> :
          inspections.map(i => (
            <View key={i.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{i.inspectionNumber}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  {i.vehicleName} · {i.assignedTo ?? "Unassigned"} · {formatDate(i.createdAt)}
                </Text>
              </View>
              <StatusBadge status={i.status} />
            </View>
          ))
        ) : (
          jobs.length === 0 ? <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No jobs.</Text> :
          jobs.map(j => (
            <View key={j.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{j.estimateNumber}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  {j.vehicleName} · {j.technicianName ?? "Unassigned"} · {formatDate(j.createdAt)}
                </Text>
              </View>
              <StatusBadge status={j.status} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12 },
  tabLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tabCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  rowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
});
