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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

interface PoLine {
  id: number;
  partNumber: string;
  partName: string;
  qty: string;
  unitCost: string;
}

export default function PartsInventory() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userCode } = useAuth();
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
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewModal, setAiReviewModal] = useState(false);
  const [aiResult, setAiResult] = useState<{ summary: string; draftOrders: Array<{ id: number; orderNumber: string; supplierName: string; priority: string; itemCount: number; status: string }>; lowStockCount: number } | null>(null);
  const [aiApproveLoading, setAiApproveLoading] = useState<number | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const scanRef = useRef<TextInput>(null);

  // Multi-select + PO generation
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [genPoModal, setGenPoModal] = useState(false);
  const [poSupplierName, setPoSupplierName] = useState("");
  const [poSupplierCode, setPoSupplierCode] = useState("");
  const [poCurrency, setPoCurrency] = useState("USD");
  const [poNotes, setPoNotes] = useState("");
  const [poLines, setPoLines] = useState<PoLine[]>([]);
  const [poSubmitting, setPoSubmitting] = useState(false);
  const [poSuccess, setPoSuccess] = useState<string | null>(null);
  const [poError, setPoError] = useState("");

  const toggleSelect = (item: PartItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const openGenPo = () => {
    const selected = items.filter((i) => selectedIds.has(i.id));
    setPoLines(
      selected.map((i) => ({
        id: i.id,
        partNumber: i.partNumber,
        partName: i.name,
        qty: String(Math.max(1, i.maxStock - i.qtyOnHand)),
        unitCost: i.unitCost ?? "",
      }))
    );
    setPoSupplierName("");
    setPoSupplierCode("");
    setPoCurrency("USD");
    setPoNotes("");
    setPoSuccess(null);
    setPoError("");
    setGenPoModal(true);
  };

  const submitGenPo = async (isDraft: boolean) => {
    if (!poSupplierName.trim() || poLines.length === 0) {
      setPoError("Supplier name is required.");
      return;
    }
    setPoError("");
    setPoSubmitting(true);
    try {
      const res = await fetch(`${BASE}/parts/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierCode: poSupplierCode.trim() || poSupplierName.slice(0, 8).toUpperCase(),
          supplierName: poSupplierName.trim(),
          currency: poCurrency,
          notes: poNotes.trim() || null,
          isDraft,
          createdBy: userCode,
          items: poLines.map((l) => ({
            partNumber: l.partNumber,
            partName: l.partName,
            qtyOrdered: parseInt(l.qty) || 1,
            unitCost: l.unitCost || null,
          })),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setPoSuccess(d.orderNumber);
        setTimeout(() => {
          setGenPoModal(false);
          setSelectMode(false);
          setSelectedIds(new Set());
          setPoSuccess(null);
        }, 1800);
      } else {
        const err = await res.json();
        setPoError(err.error ?? "Failed to create PO");
      }
    } catch {
      setPoError("Connection error. Try again.");
    } finally {
      setPoSubmitting(false);
    }
  };

  const buildUrl = useCallback(() => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (activeFilter === "Low Stock") qs.set("lowStock", "true");
    if (activeFilter === "Out of Stock") qs.set("outOfStock", "true");
    if (activeCategory !== "All") qs.set("category", activeCategory);
    return `${BASE}/parts/items?${qs.toString()}`;
  }, [search, activeFilter, activeCategory]);

  const runAiStockReview = async () => {
    setAiReviewLoading(true);
    try {
      const res = await fetch(`${BASE}/parts/ai/stock-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdBy: userCode }),
      });
      if (res.ok) {
        const d = await res.json();
        setAiResult(d);
        setAiReviewModal(true);
      }
    } catch { /* */ } finally { setAiReviewLoading(false); }
  };

  const approveAiDraftPo = async (orderId: number) => {
    setAiApproveLoading(orderId);
    try {
      const res = await fetch(`${BASE}/parts/orders/${orderId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedBy: userCode }),
      });
      if (res.ok && aiResult) {
        setAiResult({ ...aiResult, draftOrders: aiResult.draftOrders.map(o => o.id === orderId ? { ...o, status: "ordered" } : o) });
      }
    } catch { /* */ } finally { setAiApproveLoading(null); }
  };

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

  const renderItem = ({ item }: { item: PartItem }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <Pressable
        style={[
          styles.card,
          { backgroundColor: isSelected ? "#ede9fe" : colors.card, borderColor: isSelected ? "#7c3aed" : colors.border, borderLeftColor: qtyColor(item) },
        ]}
        onPress={() => selectMode ? toggleSelect(item) : router.push(`/parts/item?id=${item.id}`)}
        onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSelect(item); } }}
      >
        <View style={styles.cardTop}>
          <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
            <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
          </View>
          <View style={[styles.catBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.catText, { color: colors.mutedForeground }]}>{item.category}</Text>
          </View>
          <View style={styles.spacer} />
          {selectMode && (
            <View style={[styles.checkbox, { backgroundColor: isSelected ? "#7c3aed" : "transparent", borderColor: isSelected ? "#7c3aed" : colors.mutedForeground }]}>
              {isSelected && <Feather name="check" size={12} color="#fff" />}
            </View>
          )}
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
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Inventory"
        subtitle={selectMode ? `${selectedIds.size} selected` : `${items.length} parts`}
        showNotifications={false}
        rightElement={
          <View style={{ flexDirection: "row", gap: 8 }}>
            {selectMode ? (
              <Pressable
                style={[styles.scanBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => { setSelectMode(false); setSelectedIds(new Set()); }}
              >
                <Feather name="x" size={14} color={colors.foreground} />
                <Text style={[styles.scanBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={[styles.scanBtn, { backgroundColor: "#7c3aed" }]}
                  onPress={runAiStockReview}
                  disabled={aiReviewLoading}
                >
                  {aiReviewLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Feather name="cpu" size={14} color="#fff" /><Text style={styles.scanBtnText}>AI Review</Text></>}
                </Pressable>
                <Pressable
                  style={[styles.scanBtn, { backgroundColor: "#7c3aed" }]}
                  onPress={() => { setScanModalVisible(true); setTimeout(() => scanRef.current?.focus(), 300); }}
                >
                  <Feather name="search" size={16} color="#fff" />
                  <Text style={styles.scanBtnText}>Scan</Text>
                </Pressable>
              </>
            )}
          </View>
        }
      />

      {/* Select mode hint banner */}
      {!selectMode && (activeFilter === "Low Stock" || activeFilter === "Out of Stock") && (
        <Pressable
          style={[styles.selectHint, { backgroundColor: "#ede9fe", borderColor: "#c4b5fd" }]}
          onPress={() => setSelectMode(true)}
        >
          <Feather name="check-square" size={14} color="#7c3aed" />
          <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#7c3aed", flex: 1 }}>
            Tap to enter select mode — pick items and generate a PO
          </Text>
          <Feather name="chevron-right" size={14} color="#7c3aed" />
        </Pressable>
      )}

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
          contentContainerStyle={[styles.list, { paddingBottom: selectMode && selectedIds.size > 0 ? bottomPad + 96 : bottomPad + 24 }]}
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

      {/* Floating Generate PO bar */}
      {selectMode && selectedIds.size > 0 && (
        <View style={[styles.floatingBar, { bottom: bottomPad + 12, backgroundColor: colors.card, borderColor: "#7c3aed" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>
              {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected
            </Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              Tap Generate PO to create a purchase order
            </Text>
          </View>
          <Pressable style={styles.genPoBtn} onPress={openGenPo}>
            <Feather name="shopping-cart" size={16} color="#fff" />
            <Text style={styles.genPoBtnText}>Generate PO</Text>
          </Pressable>
        </View>
      )}

      {/* ── Generate PO Modal ────────────────────────────── */}
      <Modal visible={genPoModal} animationType="slide" onRequestClose={() => !poSubmitting && setGenPoModal(false)}>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <View style={[styles.poModalHeader, { borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
            <Pressable onPress={() => { if (!poSubmitting) setGenPoModal(false); }} style={styles.backBtn}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.poModalTitle, { color: colors.foreground }]}>Generate Purchase Order</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                {poLines.length} item{poLines.length !== 1 ? "s" : ""} · fill in supplier details below
              </Text>
            </View>
          </View>

          {poSuccess ? (
            <View style={styles.poSuccessView}>
              <View style={[styles.poSuccessIcon, { backgroundColor: "#dcfce7" }]}>
                <Feather name="check-circle" size={40} color="#16a34a" />
              </View>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>PO Created!</Text>
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#7c3aed" }}>{poSuccess}</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
                Your purchase order has been saved. Go to Orders to manage it.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={[styles.poModalContent, { paddingBottom: bottomPad + 100 }]} keyboardShouldPersistTaps="handled">

              {/* Supplier */}
              <Text style={[styles.poFieldLabel, { color: colors.mutedForeground }]}>Supplier Name *</Text>
              <TextInput
                style={[styles.poInput, { color: colors.foreground, borderColor: poError && !poSupplierName.trim() ? "#ef4444" : colors.border }]}
                placeholder="e.g. Bosch Auto Parts"
                placeholderTextColor={colors.mutedForeground}
                value={poSupplierName}
                onChangeText={(v) => { setPoSupplierName(v); setPoError(""); }}
              />
              <Text style={[styles.poFieldLabel, { color: colors.mutedForeground }]}>Supplier Code (optional)</Text>
              <TextInput
                style={[styles.poInput, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="e.g. BOSCH"
                placeholderTextColor={colors.mutedForeground}
                value={poSupplierCode}
                onChangeText={setPoSupplierCode}
                autoCapitalize="characters"
              />

              {/* Currency chips */}
              <Text style={[styles.poFieldLabel, { color: colors.mutedForeground }]}>Currency</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                {["USD", "EUR", "GBP", "QAR", "AED"].map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setPoCurrency(c)}
                    style={[styles.currChip, { backgroundColor: poCurrency === c ? "#7c3aed" : colors.secondary, borderColor: poCurrency === c ? "#7c3aed" : colors.border }]}
                  >
                    <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: poCurrency === c ? "#fff" : colors.foreground }}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.poFieldLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.poInput, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="Delivery instructions, priority notes…"
                placeholderTextColor={colors.mutedForeground}
                value={poNotes}
                onChangeText={setPoNotes}
                multiline
              />

              {/* Items */}
              <Text style={[styles.poSectionLabel, { color: colors.foreground }]}>Items to Order</Text>
              {poLines.map((line, idx) => (
                <View key={line.id} style={[styles.poItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.pnBadge2, { backgroundColor: "#7c3aed20" }]}>
                      <Text style={[styles.pnText2, { color: "#7c3aed" }]}>{line.partNumber}</Text>
                    </View>
                    <Pressable onPress={() => setPoLines((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8} style={{ marginLeft: "auto" }}>
                      <Feather name="trash-2" size={15} color="#ef4444" />
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground }} numberOfLines={1}>{line.partName}</Text>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 2 }}>Qty to order</Text>
                      <TextInput
                        style={[styles.poLineInput, { color: colors.foreground, borderColor: colors.border }]}
                        value={line.qty}
                        onChangeText={(v) => setPoLines((prev) => prev.map((l, i) => i === idx ? { ...l, qty: v } : l))}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 2 }}>Unit cost ({poCurrency})</Text>
                      <TextInput
                        style={[styles.poLineInput, { color: colors.foreground, borderColor: colors.border }]}
                        value={line.unitCost}
                        onChangeText={(v) => setPoLines((prev) => prev.map((l, i) => i === idx ? { ...l, unitCost: v } : l))}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                  </View>
                </View>
              ))}

              {poError ? (
                <View style={[styles.poErrorBox, { backgroundColor: "#fee2e2", borderColor: "#fecaca" }]}>
                  <Feather name="alert-circle" size={14} color="#dc2626" />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#dc2626", flex: 1 }}>{poError}</Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          {!poSuccess && (
            <View style={[styles.poFooter, { borderTopColor: colors.border, backgroundColor: colors.card, paddingBottom: bottomPad + 8 }]}>
              <Pressable
                style={[styles.poDraftBtn, { borderColor: poSubmitting ? colors.border : "#7c3aed", opacity: poSubmitting ? 0.6 : 1 }]}
                onPress={() => submitGenPo(true)}
                disabled={poSubmitting}
              >
                {poSubmitting ? <ActivityIndicator size="small" color="#7c3aed" /> : (
                  <>
                    <Feather name="save" size={16} color="#7c3aed" />
                    <Text style={[styles.poDraftBtnText, { color: "#7c3aed" }]}>Save as Draft</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.poSendBtn, { backgroundColor: poSubmitting ? "#7c3aed80" : "#7c3aed", opacity: poSubmitting ? 0.7 : 1 }]}
                onPress={() => submitGenPo(false)}
                disabled={poSubmitting}
              >
                {poSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Feather name="send" size={16} color="#fff" />
                    <Text style={styles.poSendBtnText}>Send PO</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

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

      {/* ── AI Stock Review Modal ────────────────────────── */}
      <Modal visible={aiReviewModal} animationType="slide" onRequestClose={() => setAiReviewModal(false)}>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: Platform.OS === "ios" ? 60 : 24, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.headerBg }}>
            <Pressable onPress={() => setAiReviewModal(false)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>AI Stock Review</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                {aiResult ? `${aiResult.lowStockCount} low-stock items · ${aiResult.draftOrders.length} draft POs` : "Analysis complete"}
              </Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 30 }}>
            {aiResult && (
              <>
                {/* AI Summary */}
                <View style={{ backgroundColor: "#ede9fe", borderRadius: 12, padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="cpu" size={16} color="#7c3aed" />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#7c3aed" }}>AI Analysis</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: "#4c1d95", lineHeight: 22 }}>{aiResult.summary}</Text>
                </View>

                {/* Draft POs */}
                {aiResult.draftOrders.length > 0 ? (
                  <>
                    <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Generated Draft POs ({aiResult.draftOrders.length})</Text>
                    {aiResult.draftOrders.map(po => (
                      <View key={po.id} style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1.5, borderColor: po.status === "ordered" ? "#16a34a" : "#7c3aed", padding: 14, gap: 8 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>{po.orderNumber}</Text>
                            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{po.supplierName} · {po.itemCount} items</Text>
                          </View>
                          <View style={{ backgroundColor: po.priority === "critical" ? "#fee2e2" : po.priority === "high" ? "#fef3c7" : "#dbeafe", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: po.priority === "critical" ? "#ef4444" : po.priority === "high" ? "#d97706" : "#1d4ed8" }}>{(po.priority ?? "normal").toUpperCase()}</Text>
                          </View>
                        </View>
                        {po.status === "ordered" ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Feather name="check-circle" size={14} color="#16a34a" />
                            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#16a34a" }}>Approved & Sent</Text>
                          </View>
                        ) : (
                          <Pressable
                            style={{ backgroundColor: "#7c3aed", borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: aiApproveLoading === po.id ? 0.7 : 1 }}
                            onPress={() => approveAiDraftPo(po.id)}
                            disabled={aiApproveLoading === po.id}
                          >
                            {aiApproveLoading === po.id
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <><Feather name="check-circle" size={14} color="#fff" /><Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Approve & Send PO</Text></>}
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </>
                ) : (
                  <View style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
                    <Feather name="check-circle" size={36} color="#16a34a" />
                    <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>All stocked up!</Text>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>No purchase orders needed at this time.</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
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
  // Select mode
  selectHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  genPoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  genPoBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  // PO Modal
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  poModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  poModalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  poModalContent: { padding: 16, gap: 6 },
  poFieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 10, marginBottom: 4 },
  poInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  poSectionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 16, marginBottom: 4 },
  poItemCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  pnBadge2: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pnText2: { fontSize: 11, fontFamily: "Inter_700Bold" },
  poLineInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  poErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
  },
  poFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
  },
  poDraftBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 13,
  },
  poDraftBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  poSendBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    padding: 13,
  },
  poSendBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  poSuccessView: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  poSuccessIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  currChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
