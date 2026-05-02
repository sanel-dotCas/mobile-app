import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { CURRENCY_NAMES, CURRENCY_SYMBOLS, formatCurrency, getExchangeRate, LOCAL_CURRENCY } from "@/utils/currencies";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

type OrderStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";

interface OrderItem {
  id: number;
  partNumber: string;
  partName: string;
  qtyOrdered: number;
  qtyReceived: number;
  binCode: string | null;
  unitCost: string | null;
  discountPct: string | null;
  markupPct: string | null;
  vatPct: string | null;
  imageUrl: string | null;
  receiving?: number;
}

interface Order {
  id: number;
  orderNumber: string;
  supplierCode: string;
  supplierName: string;
  status: OrderStatus;
  invoiceNumber: string | null;
  currency: string;
  exchangeRate: string | null;
  localCurrencyCode: string;
  notes: string | null;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_META: Record<OrderStatus, { color: string; bg: string; label: string }> = {
  draft:     { color: "#64748b", bg: "#f1f5f9", label: "Draft" },
  ordered:   { color: "#1d4ed8", bg: "#dbeafe", label: "Ordered" },
  partial:   { color: "#d97706", bg: "#fef3c7", label: "Partial" },
  received:  { color: "#16a34a", bg: "#dcfce7", label: "Received" },
  cancelled: { color: "#ef4444", bg: "#fee2e2", label: "Cancelled" },
};

export default function PartsOrders() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userCode } = useAuth();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveSuccess, setReceiveSuccess] = useState(false);
  const [invoiceInput, setInvoiceInput] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const invoiceRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    try {
      const qs = filter === "pending" ? "?status=ordered&status=partial" : "";
      const res = await fetch(`${BASE}/parts/orders${qs}`);
      if (res.ok) {
        const d = await res.json();
        setOrders(d.orders ?? []);
      }
    } catch {
      //
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openOrder = async (order: Order) => {
    try {
      const res = await fetch(`${BASE}/parts/orders/${order.id}`);
      if (res.ok) {
        const d = await res.json();
        const withReceiving = { ...d, items: d.items.map((i: OrderItem) => ({ ...i, receiving: i.qtyOrdered - i.qtyReceived })) };
        setSelectedOrder(withReceiving);
        setInvoiceInput(d.invoiceNumber ?? "");
        setInvoiceError("");
        setReceiveSuccess(false);
      }
    } catch {
      setSelectedOrder({ ...order, items: order.items ?? [] });
      setInvoiceInput(order.invoiceNumber ?? "");
    }
  };

  const updateReceiving = (itemId: number, val: number) => {
    if (!selectedOrder) return;
    setSelectedOrder({
      ...selectedOrder,
      items: selectedOrder.items.map((i) =>
        i.id === itemId ? { ...i, receiving: Math.max(0, Math.min(val, i.qtyOrdered - i.qtyReceived)) } : i
      ),
    });
  };

  const submitReceive = async () => {
    if (!selectedOrder) return;
    if (!invoiceInput.trim()) {
      setInvoiceError("Invoice number is required before receiving parts.");
      invoiceRef.current?.focus();
      return;
    }
    setInvoiceError("");
    setReceiveLoading(true);
    try {
      const payload = {
        receivedBy: userCode,
        invoiceNumber: invoiceInput.trim(),
        items: selectedOrder.items
          .filter((i) => (i.receiving ?? 0) > 0)
          .map((i) => ({ orderItemId: i.id, qtyReceived: i.receiving ?? 0, binCode: i.binCode })),
      };
      const res = await fetch(`${BASE}/parts/orders/${selectedOrder.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setReceiveSuccess(true);
        load();
        const updated = await res.json();
        if (updated.order) {
          setSelectedOrder({ ...updated.order, items: (updated.order.items ?? []).map((i: OrderItem) => ({ ...i, receiving: 0 })) });
        }
      } else {
        const err = await res.json();
        setInvoiceError(err.error ?? "Receive failed");
      }
    } catch {
      setInvoiceError("Connection error. Try again.");
    } finally {
      setReceiveLoading(false);
    }
  };

  const totalReceiving = selectedOrder?.items.reduce((acc, i) => acc + (i.receiving ?? 0), 0) ?? 0;

  const calcLineCost = (item: OrderItem): { net: number; vat: number; total: number } => {
    const unit = parseFloat(item.unitCost ?? "0") || 0;
    const qty = item.qtyOrdered;
    const disc = parseFloat(item.discountPct ?? "0") || 0;
    const markup = parseFloat(item.markupPct ?? "0") || 0;
    const vat = parseFloat(item.vatPct ?? "5") || 5;
    const afterDisc = unit * qty * (1 - disc / 100);
    const net = afterDisc * (1 + markup / 100);
    const vatAmt = net * (vat / 100);
    return { net, vat: vatAmt, total: net + vatAmt };
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Orders" subtitle="Parts Receiving" showNotifications={false} />

      <View style={styles.tabs}>
        {(["pending", "all"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.tab, { borderBottomColor: filter === f ? "#7c3aed" : "transparent", borderBottomWidth: 2 }]}
          >
            <Text style={[styles.tabText, { color: filter === f ? "#7c3aed" : colors.mutedForeground }]}>
              {f === "pending" ? "Pending" : "All Orders"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {filter === "pending" ? "No pending orders" : "No orders yet"}
              </Text>
            </View>
          }
          renderItem={({ item: order }) => {
            const meta = STATUS_META[order.status];
            const pending = (order.items ?? []).reduce((s, i) => s + (i.qtyOrdered - i.qtyReceived), 0);
            const sym = CURRENCY_SYMBOLS[order.currency] ?? order.currency;
            return (
              <Pressable
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: meta.color }]}
                onPress={() => openOrder(order)}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.orderNum, { color: colors.foreground }]}>{order.orderNumber}</Text>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <Text style={[styles.supplier, { color: colors.mutedForeground }]}>{order.supplierName}</Text>
                <View style={styles.cardMid}>
                  {order.invoiceNumber ? (
                    <View style={[styles.invBadge, { backgroundColor: "#dcfce7" }]}>
                      <Feather name="file-text" size={10} color="#16a34a" />
                      <Text style={[styles.invText, { color: "#16a34a" }]}>{order.invoiceNumber}</Text>
                    </View>
                  ) : (
                    order.status !== "received" && order.status !== "cancelled" && (
                      <View style={[styles.invBadge, { backgroundColor: "#fef3c7" }]}>
                        <Feather name="alert-circle" size={10} color="#d97706" />
                        <Text style={[styles.invText, { color: "#d97706" }]}>Invoice required</Text>
                      </View>
                    )
                  )}
                  <Text style={[styles.currencyTag, { color: colors.mutedForeground }]}>{sym} {order.currency}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                    {(order.items ?? []).length} item{(order.items ?? []).length !== 1 ? "s" : ""}
                  </Text>
                  {pending > 0 && order.status !== "received" && order.status !== "cancelled" && (
                    <View style={[styles.pendingBadge, { backgroundColor: "#dbeafe" }]}>
                      <Text style={[styles.pendingText, { color: "#1d4ed8" }]}>{pending} units to receive</Text>
                    </View>
                  )}
                </View>
                {order.expectedAt && order.status !== "received" && (
                  <Text style={[styles.expectedText, { color: colors.mutedForeground }]}>
                    Expected: {new Date(order.expectedAt).toLocaleDateString()}
                  </Text>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={!!selectedOrder} animationType="slide" onRequestClose={() => setSelectedOrder(null)}>
        {selectedOrder && (
          <View style={[styles.modalScreen, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
              <Pressable onPress={() => setSelectedOrder(null)} style={styles.backBtn}>
                <Feather name="x" size={22} color={colors.foreground} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>{selectedOrder.orderNumber}</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{selectedOrder.supplierName}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: STATUS_META[selectedOrder.status].bg }]}>
                <Text style={[styles.badgeText, { color: STATUS_META[selectedOrder.status].color }]}>{STATUS_META[selectedOrder.status].label}</Text>
              </View>
            </View>

            {receiveSuccess && (
              <View style={[styles.successBanner, { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" }]}>
                <Feather name="check-circle" size={16} color="#16a34a" />
                <Text style={[styles.successText, { color: "#16a34a" }]}>Items received — stock updated</Text>
              </View>
            )}

            <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: bottomPad + 80 }]}>
              {/* Currency info */}
              <View style={[styles.currencyCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <View style={styles.currencyRow}>
                  <Feather name="dollar-sign" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.currencyInfo, { color: colors.foreground }]}>
                    {CURRENCY_NAMES[selectedOrder.currency] ?? selectedOrder.currency} ({selectedOrder.currency})
                  </Text>
                  {selectedOrder.currency !== (selectedOrder.localCurrencyCode ?? LOCAL_CURRENCY) && (
                    <Text style={[styles.exchangeInfo, { color: colors.mutedForeground }]}>
                      1 {selectedOrder.currency} = {getExchangeRate(selectedOrder.currency, selectedOrder.localCurrencyCode ?? LOCAL_CURRENCY).toFixed(4)} {selectedOrder.localCurrencyCode}
                    </Text>
                  )}
                </View>
              </View>

              {/* Invoice number — REQUIRED */}
              <View style={[styles.invoiceSection, { backgroundColor: colors.card, borderColor: invoiceError ? "#ef4444" : colors.border }]}>
                <View style={styles.invoiceLabelRow}>
                  <Feather name="file-text" size={14} color={invoiceError ? "#ef4444" : "#7c3aed"} />
                  <Text style={[styles.invoiceLabel, { color: invoiceError ? "#ef4444" : colors.foreground }]}>
                    Supplier Invoice Number {selectedOrder.status !== "received" ? "(required)" : ""}
                  </Text>
                </View>
                <TextInput
                  ref={invoiceRef}
                  style={[styles.invoiceInput, {
                    color: colors.foreground,
                    borderColor: invoiceError ? "#ef4444" : colors.border,
                    backgroundColor: colors.background,
                  }]}
                  placeholder="e.g. INV-BOSCH-00421"
                  placeholderTextColor={colors.mutedForeground}
                  value={invoiceInput}
                  onChangeText={(v) => { setInvoiceInput(v); setInvoiceError(""); }}
                  editable={selectedOrder.status !== "received" && selectedOrder.status !== "cancelled"}
                  autoCapitalize="characters"
                />
                {invoiceError ? (
                  <Text style={styles.invoiceError}>{invoiceError}</Text>
                ) : null}
              </View>

              {selectedOrder.notes && (
                <View style={[styles.notesBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{selectedOrder.notes}</Text>
                </View>
              )}

              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Order Items</Text>

              {selectedOrder.items.map((item) => {
                const remaining = item.qtyOrdered - item.qtyReceived;
                const { net, vat, total } = calcLineCost(item);
                const sym = CURRENCY_SYMBOLS[selectedOrder.currency] ?? selectedOrder.currency;
                const localCurrency = selectedOrder.localCurrencyCode ?? LOCAL_CURRENCY;
                const rate = parseFloat(selectedOrder.exchangeRate ?? "1") || 1;

                return (
                  <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.itemHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.itemBadgeRow}>
                          <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                            <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
                          </View>
                          {item.binCode && (
                            <View style={[styles.binBadge, { backgroundColor: colors.secondary }]}>
                              <Feather name="grid" size={10} color={colors.mutedForeground} />
                              <Text style={[styles.binText, { color: colors.mutedForeground }]}>Bin {item.binCode}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.itemName, { color: colors.foreground }]}>{item.partName}</Text>
                      </View>
                      {/* Part image thumbnail */}
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.itemThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.itemThumbPlaceholder, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                          <Feather name="image" size={18} color={colors.mutedForeground} />
                        </View>
                      )}
                    </View>

                    <View style={styles.qtyRow}>
                      <Text style={[styles.qtyLabel, { color: colors.mutedForeground }]}>
                        Ordered: {item.qtyOrdered} · Received: {item.qtyReceived} · Remaining: {remaining}
                      </Text>
                    </View>

                    {/* Pricing breakdown */}
                    {item.unitCost && (
                      <View style={[styles.costRow, { backgroundColor: colors.secondary, borderRadius: 6, padding: 6 }]}>
                        <Text style={[styles.costText, { color: colors.mutedForeground }]}>
                          {sym}{parseFloat(item.unitCost).toFixed(2)}/unit
                          {parseFloat(item.discountPct ?? "0") > 0 ? ` · -${item.discountPct}% disc` : ""}
                          {parseFloat(item.markupPct ?? "0") > 0 ? ` · +${item.markupPct}% markup` : ""}
                          {` · VAT ${item.vatPct ?? 5}%`}
                        </Text>
                        <Text style={[styles.costTotal, { color: colors.foreground }]}>
                          Net {sym}{net.toFixed(2)} + VAT {sym}{vat.toFixed(2)} = {sym}{total.toFixed(2)}
                          {selectedOrder.currency !== localCurrency && (
                            ` ≈ ${CURRENCY_SYMBOLS[localCurrency] ?? localCurrency}${(total * rate).toFixed(2)}`
                          )}
                        </Text>
                      </View>
                    )}

                    {remaining > 0 && selectedOrder.status !== "received" && selectedOrder.status !== "cancelled" && (
                      <View style={styles.receiveRow}>
                        <Text style={[styles.receiveLabel, { color: colors.foreground }]}>Receive now:</Text>
                        <Pressable
                          onPress={() => updateReceiving(item.id, (item.receiving ?? 0) - 1)}
                          style={[styles.qtyBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                        >
                          <Feather name="minus" size={16} color={colors.foreground} />
                        </Pressable>
                        <TextInput
                          style={[styles.qtyInput, { color: colors.foreground, borderColor: colors.border }]}
                          value={String(item.receiving ?? 0)}
                          onChangeText={(v) => updateReceiving(item.id, parseInt(v) || 0)}
                          keyboardType="number-pad"
                        />
                        <Pressable
                          onPress={() => updateReceiving(item.id, (item.receiving ?? 0) + 1)}
                          style={[styles.qtyBtn, { backgroundColor: "#7c3aed20", borderColor: "#7c3aed" }]}
                        >
                          <Feather name="plus" size={16} color="#7c3aed" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {selectedOrder.status !== "received" && selectedOrder.status !== "cancelled" && totalReceiving > 0 && (
              <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                {!invoiceInput.trim() && (
                  <View style={[styles.invoiceWarning, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
                    <Feather name="alert-triangle" size={14} color="#d97706" />
                    <Text style={{ color: "#d97706", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
                      Enter the supplier invoice number above before receiving
                    </Text>
                  </View>
                )}
                <Pressable
                  style={[styles.receiveBtn, { backgroundColor: receiveLoading ? "#7c3aed80" : "#7c3aed" }]}
                  onPress={submitReceive}
                  disabled={receiveLoading}
                >
                  {receiveLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="download" size={18} color="#fff" />
                      <Text style={styles.receiveBtnText}>
                        Receive {totalReceiving} unit{totalReceiving !== 1 ? "s" : ""} into stock
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "transparent", paddingHorizontal: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  list: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 300, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 10, borderWidth: 1, borderLeftWidth: 4, padding: 13, gap: 4 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderNum: { fontSize: 15, fontFamily: "Inter_700Bold" },
  supplier: { fontSize: 13, fontFamily: "Inter_400Regular" },
  cardMid: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  invBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  invText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  currencyTag: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pendingBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pendingText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  expectedText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  modalScreen: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, borderRadius: 10, borderWidth: 1, padding: 10 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalContent: { padding: 16, gap: 10 },
  currencyCard: { borderRadius: 10, borderWidth: 1, padding: 10 },
  currencyRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  currencyInfo: { fontSize: 13, fontFamily: "Inter_500Medium" },
  exchangeInfo: { fontSize: 12, fontFamily: "Inter_400Regular" },
  invoiceSection: { borderRadius: 10, borderWidth: 1.5, padding: 12, gap: 8 },
  invoiceLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  invoiceLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  invoiceInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  invoiceError: { color: "#ef4444", fontSize: 12, fontFamily: "Inter_500Medium" },
  notesBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  notesText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  itemCard: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  itemHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  itemBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pnBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pnText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  binBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  binText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  itemThumb: { width: 56, height: 56, borderRadius: 8 },
  itemThumbPlaceholder: { width: 56, height: 56, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 4 },
  qtyRow: { flexDirection: "row", alignItems: "center" },
  qtyLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  costRow: { gap: 2 },
  costText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  costTotal: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  receiveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  receiveLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  qtyBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyInput: { width: 50, height: 34, borderRadius: 8, borderWidth: 1, textAlign: "center", fontSize: 15, fontFamily: "Inter_700Bold" },
  modalFooter: { borderTopWidth: 1, padding: 16, gap: 8 },
  invoiceWarning: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 8 },
  receiveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, padding: 14 },
  receiveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
