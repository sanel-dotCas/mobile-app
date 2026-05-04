import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
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

interface AdminStats {
  totalUsers: number;
  totalTechnicians: number;
  totalVehicles: number;
  totalInspections: number;
  totalJobs: number;
  totalLocations: number;
  totalServicePackages: number;
  vehiclesByStatus: Record<string, number>;
  inspectionsByStatus: Record<string, number>;
  jobsByStatus: Record<string, number>;
}

interface ActivityItem {
  id: number;
  action: string;
  actor: string;
  createdAt: string;
  locationName: string;
}

function StatCard({
  label, value, icon, color, bg, colors,
}: {
  label: string; value: number | string;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string; bg: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsRes, actRes] = await Promise.all([
        fetch(`${BASE}/admin/stats`),
        fetch(`${BASE}/admin/activity`),
      ]);
      if (statsRes.ok) {
        const raw = await statsRes.json();
        setStats({
          totalUsers: raw.users ?? 0,
          totalTechnicians: raw.technicians ?? 0,
          totalVehicles: raw.vehicles?.total ?? 0,
          totalInspections: raw.inspections?.total ?? 0,
          totalJobs: raw.jobs?.total ?? 0,
          totalLocations: raw.locations ?? 0,
          totalServicePackages: raw.servicePackages ?? 0,
          vehiclesByStatus: raw.vehicles?.byStatus ?? {},
          inspectionsByStatus: raw.inspections?.byStatus ?? {},
          jobsByStatus: raw.jobs?.byStatus ?? {},
        });
      }
      if (actRes.ok) {
        const raw = await actRes.json();
        setActivity(Array.isArray(raw) ? raw : raw.activity ?? []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const statusColor = (s: string) => {
    if (s.includes("complet") || s === "available" || s === "passed") return colors.success;
    if (s.includes("progress") || s === "queued" || s === "pdi_pending") return colors.primary;
    if (s.includes("hold") || s === "in_transit") return colors.warning;
    return colors.mutedForeground;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Admin Dashboard" subtitle="IGMMA DMS Control Centre" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stat cards */}
        <View style={styles.statGrid}>
          <StatCard label="System Users" value={stats?.totalUsers ?? 0} icon="users" color="#1d4ed8" bg="#dbeafe" colors={colors} />
          <StatCard label="Technicians" value={stats?.totalTechnicians ?? 0} icon="tool" color="#7c3aed" bg="#ede9fe" colors={colors} />
          <StatCard label="Vehicles" value={stats?.totalVehicles ?? 0} icon="truck" color="#16a34a" bg="#dcfce7" colors={colors} />
          <StatCard label="Inspections" value={stats?.totalInspections ?? 0} icon="clipboard" color="#d97706" bg="#fef3c7" colors={colors} />
          <StatCard label="Jobs" value={stats?.totalJobs ?? 0} icon="briefcase" color="#dc2626" bg="#fee2e2" colors={colors} />
          <StatCard label="Locations" value={stats?.totalLocations ?? 0} icon="map-pin" color="#0284c7" bg="#e0f2fe" colors={colors} />
        </View>

        {/* Vehicles by status */}
        {stats?.vehiclesByStatus && Object.keys(stats.vehiclesByStatus).length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicles by Status</Text>
            {Object.entries(stats.vehiclesByStatus).map(([s, n]) => (
              <View key={s} style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(s) }]} />
                <Text style={[styles.statusLabel, { color: colors.foreground }]}>{s.replace(/_/g, " ")}</Text>
                <Text style={[styles.statusCount, { color: colors.mutedForeground }]}>{n}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Jobs by status */}
        {stats?.jobsByStatus && Object.keys(stats.jobsByStatus).length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Jobs by Status</Text>
            {Object.entries(stats.jobsByStatus).map(([s, n]) => (
              <View key={s} style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(s) }]} />
                <Text style={[styles.statusLabel, { color: colors.foreground }]}>{s.replace(/_/g, " ")}</Text>
                <Text style={[styles.statusCount, { color: colors.mutedForeground }]}>{n}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent activity */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="activity" size={15} color={colors.mutedForeground} />
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginLeft: 6 }]}>Recent Activity</Text>
          </View>
          {activity.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No recent activity.</Text>
          ) : (
            activity.slice(0, 10).map((item) => (
              <View key={item.id} style={[styles.activityRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activityAction, { color: colors.foreground }]}>{item.action}</Text>
                  <Text style={[styles.activityMeta, { color: colors.mutedForeground }]}>
                    {item.actor} · {item.locationName}
                  </Text>
                </View>
                <Text style={[styles.activityTime, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: {
    width: "30%", flexGrow: 1, borderRadius: 12, borderWidth: 1,
    padding: 12, alignItems: "center", gap: 4,
  },
  statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, textAlign: "center", fontFamily: "Inter_400Regular" },
  section: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", textTransform: "capitalize" },
  statusCount: { fontSize: 13, fontFamily: "Inter_500Medium" },
  activityRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1 },
  activityAction: { fontSize: 13, fontFamily: "Inter_500Medium" },
  activityMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  activityTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 8 },
});
