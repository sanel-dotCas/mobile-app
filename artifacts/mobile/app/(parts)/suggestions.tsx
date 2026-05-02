import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
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

type Priority = "critical" | "urgent" | "warning" | "info";

interface Suggestion {
  id: number;
  partNumber: string;
  partName: string;
  binCode: string | null;
  category: string;
  qtyOnHand: number;
  minStock: number;
  maxStock: number;
  priority: Priority;
  reason: string;
  action: string;
  suggestedQty: number;
}

interface SuggestionSummary {
  critical: number;
  urgent: number;
  warning: number;
  info: number;
  total: number;
}

const PRIORITY_META: Record<Priority, { color: string; bg: string; icon: string; label: string }> = {
  critical: { color: "#dc2626", bg: "#fef2f2",   icon: "alert-circle",   label: "Critical" },
  urgent:   { color: "#d97706", bg: "#fef3c7",   icon: "alert-triangle", label: "Urgent" },
  warning:  { color: "#1d4ed8", bg: "#dbeafe",   icon: "info",           label: "Warning" },
  info:     { color: "#64748b", bg: "#f1f5f9",   icon: "bell",           label: "Info" },
};

const PRIORITY_ORDER: Priority[] = ["critical", "urgent", "warning", "info"];

export default function PartsSuggestions() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [summary, setSummary] = useState<SuggestionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Priority | "all">("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/parts/suggestions`);
      if (res.ok) {
        const d = await res.json();
        setSuggestions(d.suggestions ?? []);
        setSummary(d.summary ?? null);
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

  const filtered = activeFilter === "all"
    ? suggestions
    : suggestions.filter((s) => s.priority === activeFilter);

  const sorted = [...filtered].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  );

  const criticalCount = suggestions.filter((s) => s.priority === "critical").length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Smart Suggestions"
        subtitle="AI-powered reorder analysis"
        showNotifications={false}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : (
        <>
          {criticalCount > 0 && (
            <View style={[styles.alertBanner, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
              <Feather name="alert-circle" size={16} color="#dc2626" />
              <Text style={[styles.alertText, { color: "#dc2626" }]}>
                {criticalCount} critical item{criticalCount !== 1 ? "s" : ""} need immediate reorder
              </Text>
            </View>
          )}

          {summary && (
            <View style={styles.summaryRow}>
              {(["critical", "urgent", "warning", "info"] as Priority[]).map((p) => {
                const meta = PRIORITY_META[p];
                const count = summary[p];
                if (count === 0) return null;
                return (
                  <Pressable
                    key={p}
                    style={[styles.summaryCard, { backgroundColor: meta.bg, borderColor: meta.color + "40", borderWidth: activeFilter === p ? 2 : 1, borderColor: activeFilter === p ? meta.color : meta.color + "40" }]}
                    onPress={() => setActiveFilter(activeFilter === p ? "all" : p)}
                  >
                    <Text style={[styles.summaryCount, { color: meta.color }]}>{count}</Text>
                    <Text style={[styles.summaryLabel, { color: meta.color }]}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <FlatList
            data={sorted}
            keyExtractor={(s) => String(s.id)}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListHeaderComponent={
              sorted.length > 0 && activeFilter !== "all" ? (
                <Pressable onPress={() => setActiveFilter("all")} style={styles.clearFilter}>
                  <Feather name="x" size={12} color="#7c3aed" />
                  <Text style={[styles.clearFilterText, { color: "#7c3aed" }]}>Clear filter</Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Feather name="check-circle" size={40} color="#16a34a" />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All good!</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {activeFilter !== "all" ? `No ${activeFilter} suggestions` : "Stock levels are healthy — no action needed"}
                </Text>
              </View>
            }
            renderItem={({ item: sug }) => {
              const meta = PRIORITY_META[sug.priority];
              return (
                <View style={[styles.sugCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: meta.color }]}>
                  <View style={styles.sugHeader}>
                    <View style={[styles.prioBadge, { backgroundColor: meta.bg }]}>
                      <Feather name={meta.icon as any} size={12} color={meta.color} />
                      <Text style={[styles.prioText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <View style={[styles.catBadge, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.catText, { color: colors.mutedForeground }]}>{sug.category}</Text>
                    </View>
                    {sug.binCode && (
                      <View style={[styles.binBadge, { backgroundColor: colors.secondary }]}>
                        <Feather name="grid" size={10} color={colors.mutedForeground} />
                        <Text style={[styles.binText, { color: colors.mutedForeground }]}>Bin {sug.binCode}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.sugPnRow}>
                    <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                      <Text style={[styles.pnText, { color: "#7c3aed" }]}>{sug.partNumber}</Text>
                    </View>
                    <Text style={[styles.sugName, { color: colors.foreground }]} numberOfLines={1}>{sug.partName}</Text>
                  </View>

                  <View style={[styles.reasonBox, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.reasonText, { color: meta.color }]}>{sug.reason}</Text>
                  </View>

                  <View style={styles.sugFooter}>
                    <View style={styles.stockRow}>
                      <Text style={[styles.stockLabel, { color: colors.mutedForeground }]}>On Hand</Text>
                      <Text style={[styles.stockValue, { color: sug.qtyOnHand === 0 ? "#dc2626" : sug.qtyOnHand < sug.minStock ? "#d97706" : colors.foreground }]}>
                        {sug.qtyOnHand}
                      </Text>
                    </View>
                    <View style={styles.stockRow}>
                      <Text style={[styles.stockLabel, { color: colors.mutedForeground }]}>Min</Text>
                      <Text style={[styles.stockValue, { color: colors.foreground }]}>{sug.minStock}</Text>
                    </View>
                    <View style={styles.stockRow}>
                      <Text style={[styles.stockLabel, { color: colors.mutedForeground }]}>Max</Text>
                      <Text style={[styles.stockValue, { color: colors.foreground }]}>{sug.maxStock}</Text>
                    </View>
                    <View style={[styles.orderQtyBox, { backgroundColor: "#7c3aed20" }]}>
                      <Text style={[styles.orderQtyLabel, { color: "#7c3aed" }]}>Order</Text>
                      <Text style={[styles.orderQtyValue, { color: "#7c3aed" }]}>{sug.suggestedQty}</Text>
                    </View>
                  </View>

                  <Text style={[styles.actionText, { color: colors.mutedForeground }]}>
                    <Feather name="arrow-right-circle" size={12} color={colors.mutedForeground} /> {sug.action}
                  </Text>
                </View>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 300, gap: 10 },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    margin: 16,
    marginBottom: 0,
    padding: 10,
  },
  alertText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 2,
  },
  summaryCount: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  list: { padding: 16, gap: 10 },
  clearFilter: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  clearFilterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260 },
  sugCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 13,
    gap: 8,
  },
  sugHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  prioBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  prioText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  catBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  binBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  binText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  sugPnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pnBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pnText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  sugName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  reasonBox: { borderRadius: 8, padding: 8 },
  reasonText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sugFooter: { flexDirection: "row", alignItems: "center", gap: 8 },
  stockRow: { flex: 1, alignItems: "center", gap: 2 },
  stockLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  stockValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  orderQtyBox: { borderRadius: 10, padding: 10, alignItems: "center", minWidth: 60, gap: 2 },
  orderQtyLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  orderQtyValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  actionText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
