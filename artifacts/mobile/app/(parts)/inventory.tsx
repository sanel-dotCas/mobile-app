import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

const CATEGORIES = ["All", "Filters", "Lubricants", "Tyres", "Batteries", "Brakes", "Electrical", "Materials", "Other"];
const FILTERS = ["All", "Low Stock", "Out of Stock"];

interface PartItem {
  id: number;
  partNumber: string;
  name: string;
  category: string;
  binCode: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  minStock: number;
  maxStock: number;
  unitCost: string | null;
  supplierCode: string | null;
  lastCountedAt: string | null;
}

export default function PartsInventory() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string; scan?: string }>();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [items, setItems] = useState<PartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>(
    params.filter === "lowStock" ? "Low Stock" : params.filter === "outOfStock" ? "Out of Stock" : "All"
  );
  const [activeCategory, setActiveCategory] = useState("All");
  const [scanModalVisible, setScanModalVisible] = useState(params.scan === "1");
  const [scanInput, setScanInput] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const scanRef = useRef<TextInput>(null);

  const buildUrl = useCallback(() => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (activeFilter === "Low Stock") qs.set("lowStock", "true");
    if (activeFilter === "Out of Stock") qs.set("outOfStock", "true");
    if (activeCategory !== "All") qs.set("category", activeCategory);
    return `${BASE}/parts/items?${qs.toString()}`;
  }, [search, activeFilter, activeCategory]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(buildUrl());
      if (res.ok) {
        const d = await res.json();
        setItems(d.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildUrl]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleScan = async () => {
    if (!scanInput.trim()) return;
    setScanLoading(true);
    setScanError("");
    try {
      const res = await fetch(`${BASE}/parts/items/by-number/${encodeURIComponent(scanInput.trim())}`);
      if (res.ok) {
        const item: PartItem = await res.json();
        setScanModalVisible(false);
        setScanInput("");
        router.push(`/parts/item?id=${item.id}`);
      } else {
        setScanError(`Part "${scanInput.trim()}" not found`);
      }
    } catch {
      setScanError("Network error — please try again");
    } finally {
      setScanLoading(false);
    }
  };

  const qtyColor = (item: PartItem) => {
    if (item.qtyOnHand === 0) return "#dc2626";
    if (item.qtyOnHand < item.minStock) return "#d97706";
    return "#16a34a";
  };
  const qtyBg = (item: PartItem) => {
    if (item.qtyOnHand === 0) return "#fef2f2";
    if (item.qtyOnHand < item.minStock) return "#fef3c7";
    return "#dcfce7";
  };

  const renderItem = ({ item }: { item: PartItem }) => (
    <Pressable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: qtyColor(item) }]}
      onPress={() => router.push(`/parts/item?id=${item.id}`)}
    >
      <View style={styles.cardTop}>
        <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
          <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
        </View>
        <View style={[styles.catBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.catText, { color: colors.mutedForeground }]}>{item.category}</Text>
        </View>
      </View>
      <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
      <View style={styles.cardBottom}>
        {item.binCode && (
          <View style={[styles.binBadge, { backgroundColor: colors.secondary }]}>
            <Feather name="grid" size={10} color={colors.mutedForeground} />
            <Text style={[styles.binText, { color: colors.mutedForeground }]}>Bin {item.binCode}</Text>
          </View>
        )}
        <View style={styles.spacer} />
        <View style={[styles.qtyBadge, { backgroundColor: qtyBg(item) }]}>
          <Text style={[styles.qtyText, { color: qtyColor(item) }]}>{item.qtyOnHand} in stock</Text>
        </View>
        <Text style={[styles.minText, { color: colors.mutedForeground }]}>min {item.minStock}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Inventory"
        subtitle={`${items.length} parts`}
        showNotifications={false}
        rightElement={
          <Pressable
            style={[styles.scanBtn, { backgroundColor: "#7c3aed" }]}
            onPress={() => { setScanModalVisible(true); setTimeout(() => scanRef.current?.focus(), 300); }}
          >
            <Feather name="search" size={16} color="#fff" />
            <Text style={styles.scanBtnText}>Scan</Text>
          </Pressable>
        }
      />

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search parts…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={(v) => { setSearch(v); }}
          onSubmitEditing={load}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => { setSearch(""); }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <View style={styles.filtersRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(i) => i}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          renderItem={({ item: f }) => (
            <Pressable
              onPress={() => setActiveFilter(f)}
              style={[styles.chip, { backgroundColor: activeFilter === f ? "#7c3aed" : colors.secondary, borderColor: activeFilter === f ? "#7c3aed" : colors.border }]}
            >
              <Text style={[styles.chipText, { color: activeFilter === f ? "#fff" : colors.mutedForeground }]}>{f}</Text>
            </Pressable>
          )}
        />
      </View>

      <View style={styles.catsRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(i) => i}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          renderItem={({ item: c }) => (
            <Pressable
              onPress={() => setActiveCategory(c)}
              style={[styles.catChip, { backgroundColor: activeCategory === c ? "#e9d5ff" : colors.secondary, borderColor: activeCategory === c ? "#7c3aed" : colors.border }]}
            >
              <Text style={[styles.catChipText, { color: activeCategory === c ? "#7c3aed" : colors.mutedForeground }]}>{c}</Text>
            </Pressable>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="package" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No parts found</Text>
            </View>
          }
        />
      )}

      <Modal visible={scanModalVisible} transparent animationType="slide" onRequestClose={() => setScanModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => { setScanModalVisible(false); Keyboard.dismiss(); }}>
          <View style={[styles.scanModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.scanTitle, { color: colors.foreground }]}>Scan or Enter Part Number</Text>
            <Text style={[styles.scanHint, { color: colors.mutedForeground }]}>Scan barcode or type a part number to look it up</Text>
            <TextInput
              ref={scanRef}
              style={[styles.scanInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="e.g. OIL-5W30-4L"
              placeholderTextColor={colors.mutedForeground}
              value={scanInput}
              onChangeText={(v) => { setScanInput(v); setScanError(""); }}
              onSubmitEditing={handleScan}
              returnKeyType="search"
              autoCapitalize="characters"
            />
            {scanError ? <Text style={styles.scanError}>{scanError}</Text> : null}
            <View style={styles.scanActions}>
              <Pressable
                style={[styles.scanCancel, { borderColor: colors.border }]}
                onPress={() => { setScanModalVisible(false); setScanInput(""); setScanError(""); }}
              >
                <Text style={[styles.scanCancelText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.scanConfirm, { backgroundColor: "#7c3aed", opacity: scanLoading ? 0.7 : 1 }]}
                onPress={handleScan}
                disabled={scanLoading}
              >
                {scanLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.scanConfirmText}>Look Up</Text>}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filtersRow: { marginTop: 10 },
  catsRow: { marginTop: 8, marginBottom: 4 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  catChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  catChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  list: { padding: 16, gap: 8 },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    gap: 6,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  pnBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pnText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  catBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  itemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 6 },
  binBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  binText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  spacer: { flex: 1 },
  qtyBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  qtyText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  minText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  scanBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modalOverlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  scanModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 12,
  },
  scanTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  scanHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  scanInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
  },
  scanError: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#dc2626" },
  scanActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  scanCancel: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "center" },
  scanCancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  scanConfirm: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  scanConfirmText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
