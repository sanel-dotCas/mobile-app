import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

interface DashboardStats {
  totalParts: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingOrders: number;
  inProgressCounts: number;
  pendingRoRequests: number;
  pendingTransfers: number;
  todaySalesCount: number;
  lastCountDate: string | null;
  criticalItems: Array<{ id: number; partNumber: string; name: string; binCode: string | null }>;
}

interface RecentOrder {
  id: number;
  orderNumber: string;
  supplierName: string;
  status: string;
  itemCount: number;
  createdAt: string;
}

interface LowStockItem {
  id: number;
  partNumber: string;
  name: string;
  qtyOnHand: number;
  minStock: number;
  binCode: string | null;
}

export default function PartsDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [criticalItems, setCriticalItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsRes, ordersRes, lowRes] = await Promise.all([
        fetch(`${BASE}/parts/dashboard`),
        fetch(`${BASE}/parts/orders?limit=3`),
        fetch(`${BASE}/parts/items?outOfStock=true&limit=5`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (ordersRes.ok) {
        const d = await ordersRes.json();
        setRecentOrders(d.orders ?? []);
      }
      if (lowRes.ok) {
        const d = await lowRes.json();
        setCriticalItems(d.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const statusColor = (s: string) => {
    if (s === "received") return "#16a34a";
    if (s === "ordered") return "#1d4ed8";
    if (s === "partial") return "#d97706";
    return "#64748b";
  };
  const statusLabel = (s: string) =>
    s === "ordered" ? "Ordered" : s === "partial" ? "Partial" : s === "received" ? "Received" : s;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Parts"
        subtitle="Inventory & Receiving"
        showNotifications={false}
        rightElement={
          <Pressable onPress={logout} style={[styles.logoutBtn, { borderColor: colors.border }]}>
            <Feather name="log-out" size={14} color={colors.foreground} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        ) : (
          <>
            {criticalItems.length > 0 && (
              <View style={[styles.alertBanner, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                <Feather name="alert-circle" size={16} color="#dc2626" />
                <Text style={[styles.alertText, { color: "#dc2626" }]}>
                  {criticalItems.length} item{criticalItems.length !== 1 ? "s" : ""} out of stock — action required
                </Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Overview</Text>
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="package" size={20} color="#7c3aed" />
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>{stats?.totalParts ?? "—"}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Total Parts</Text>
              </View>
              <Pressable
                style={[styles.kpiCard, { backgroundColor: stats?.outOfStockCount ? "#fef2f2" : colors.card, borderColor: stats?.outOfStockCount ? "#fecaca" : colors.border }]}
                onPress={() => router.push("/(parts)/inventory?filter=outOfStock")}
              >
                <Feather name="alert-triangle" size={20} color={stats?.outOfStockCount ? "#dc2626" : colors.mutedForeground} />
                <Text style={[styles.kpiValue, { color: stats?.outOfStockCount ? "#dc2626" : colors.foreground }]}>{stats?.outOfStockCount ?? 0}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Out of Stock</Text>
              </Pressable>
              <Pressable
                style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(parts)/orders")}
              >
                <Feather name="inbox" size={20} color="#1d4ed8" />
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>{stats?.pendingOrders ?? 0}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Pending Orders</Text>
              </Pressable>
              <Pressable
                style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(parts)/sales")}
              >
                <Feather name="shopping-cart" size={20} color="#059669" />
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>{stats?.todaySalesCount ?? 0}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Sales Today</Text>
              </Pressable>
              <Pressable
                style={[styles.kpiCard, { backgroundColor: stats?.pendingRoRequests ? "#fef3c7" : colors.card, borderColor: stats?.pendingRoRequests ? "#fde68a" : colors.border }]}
                onPress={() => router.push("/(parts)/requests")}
              >
                <Feather name="tool" size={20} color={stats?.pendingRoRequests ? "#d97706" : colors.mutedForeground} />
                <Text style={[styles.kpiValue, { color: stats?.pendingRoRequests ? "#d97706" : colors.foreground }]}>{stats?.pendingRoRequests ?? 0}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>RO Requests</Text>
              </Pressable>
              <Pressable
                style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(parts)/requests")}
              >
                <Feather name="shuffle" size={20} color="#7c3aed" />
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>{stats?.pendingTransfers ?? 0}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Transfers</Text>
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>Quick Actions</Text>
            <View style={styles.quickActions}>
              <Pressable style={[styles.actionBtn, { backgroundColor: "#7c3aed" }]} onPress={() => router.push("/(parts)/inventory?scan=1")}>
                <Feather name="search" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Scan</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: "#059669" }]} onPress={() => router.push("/(parts)/sales")}>
                <Feather name="shopping-cart" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>New Sale</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: "#1d4ed8" }]} onPress={() => router.push("/(parts)/orders")}>
                <Feather name="download" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Receive</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: "#d97706" }]} onPress={() => router.push("/(parts)/requests")}>
                <Feather name="tool" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Requests</Text>
              </Pressable>
            </View>

            {recentOrders.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>Recent Orders</Text>
                  <Pressable onPress={() => router.push("/(parts)/orders")} style={{ marginTop: 20 }}>
                    <Text style={{ color: "#7c3aed", fontSize: 13, fontFamily: "Inter_500Medium" }}>View all</Text>
                  </Pressable>
                </View>
                {recentOrders.map((order) => (
                  <View key={order.id} style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.orderRow}>
                      <Text style={[styles.orderNum, { color: colors.foreground }]}>{order.orderNumber}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor(order.status) + "20" }]}>
                        <Text style={[styles.statusText, { color: statusColor(order.status) }]}>{statusLabel(order.status)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.orderSup, { color: colors.mutedForeground }]}>{order.supplierName} · {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}</Text>
                  </View>
                ))}
              </>
            )}

            {criticalItems.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>Out of Stock</Text>
                {criticalItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.itemCard, { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderLeftColor: "#dc2626" }]}
                    onPress={() => router.push(`/parts/item?id=${item.id}`)}
                  >
                    <View style={styles.itemRow}>
                      <View style={[styles.pnBadge, { backgroundColor: "#dc262620" }]}>
                        <Text style={[styles.pnText, { color: "#dc2626" }]}>{item.partNumber}</Text>
                      </View>
                      {item.binCode && (
                        <View style={[styles.binBadge, { backgroundColor: colors.secondary }]}>
                          <Feather name="grid" size={10} color={colors.mutedForeground} />
                          <Text style={[styles.binText, { color: colors.mutedForeground }]}>{item.binCode}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.itemQty, { color: "#dc2626" }]}>
                      Qty: {item.qtyOnHand} / Min: {item.minStock}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200 },
  logoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  alertText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 10,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    width: "47%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  kpiValue: { fontSize: 26, fontFamily: "Inter_700Bold" },
  kpiLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  quickActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  actionBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  orderCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  orderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderNum: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  orderSup: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  itemCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pnBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pnText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  binBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  binText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  itemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  itemQty: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
