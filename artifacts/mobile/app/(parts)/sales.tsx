import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import {
  CURRENCIES,
  CURRENCY_NAMES,
  CURRENCY_SYMBOLS,
  LOCAL_CURRENCY,
  calcLineAmounts,
  convertCurrency,
  formatCurrency,
  getExchangeRate,
} from "@/utils/currencies";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

interface CartItem {
  key: string;
  partId: number;
  partNumber: string;
  partName: string;
  qty: number;
  unitPrice: string;
  discountPct: string;
  markupPct: string;
  vatPct: string;
}

interface SaleRecord {
  id: number;
  saleNumber: string;
  customerName: string | null;
  customerRef: string | null;
  status: string;
  currency: string;
  exchangeRate: string;
  localCurrencyCode: string;
  createdAt: string;
  items: Array<{
    id: number;
    partNumber: string;
    partName: string;
    qty: number;
    unitPrice: string;
    discountPct: string;
    markupPct: string;
    vatPct: string;
  }>;
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  draft:     { color: "#64748b", bg: "#f1f5f9", label: "Draft" },
  confirmed: { color: "#16a34a", bg: "#dcfce7", label: "Confirmed" },
  paid:      { color: "#7c3aed", bg: "#ede9fe", label: "Paid" },
  cancelled: { color: "#ef4444", bg: "#fee2e2", label: "Cancelled" },
};

export default function PartsSales() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userCode } = useAuth();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [mode, setMode] = useState<"list" | "new">("list");
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  // New Sale state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [localCurrency] = useState(LOCAL_CURRENCY);
  const [customerName, setCustomerName] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<SaleRecord | null>(null);

  // Scan / search modal — full-screen, input at top
  const [scanModal, setScanModal] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");
  const scanRef = useRef<TextInput>(null);

  // All-parts cache for live search
  interface PartResult {
    id: number; partNumber: string; name: string; category: string;
    qtyOnHand: number; unitSalePrice: string | null; unitCost: string | null;
    vatRate: string | null; binCode: string | null;
  }
  const [allParts, setAllParts] = useState<PartResult[]>([]);
  const [searchResults, setSearchResults] = useState<PartResult[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);

  // Line edit modal
  const [lineModal, setLineModal] = useState<CartItem | null>(null);
  const [lineEdit, setLineEdit] = useState<CartItem | null>(null);

  const exchangeRate = getExchangeRate(currency, localCurrency);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/parts/sales`);
      if (res.ok) {
        const d = await res.json();
        setSales(d.sales ?? []);
      }
    } catch {
      //
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const addPartToCart = (part: PartResult) => {
    const existing = cart.find((c) => c.partNumber === part.partNumber);
    if (existing) {
      setCart((prev) => prev.map((c) => c.partNumber === part.partNumber ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart((prev) => [
        ...prev,
        {
          key: Date.now().toString(),
          partId: part.id,
          partNumber: part.partNumber,
          partName: part.name,
          qty: 1,
          unitPrice: part.unitSalePrice ?? part.unitCost ?? "0",
          discountPct: "0",
          markupPct: "0",
          vatPct: part.vatRate ?? "5",
        },
      ]);
    }
    setScanInput("");
    setScanModal(false);
  };

  const handleSearchChange = (text: string) => {
    setScanInput(text);
    const q = text.trim().toLowerCase();
    if (!q) {
      setSearchResults(allParts);
      return;
    }
    setSearchResults(
      allParts.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.category?.toLowerCase().includes(q) ?? false) ||
          (p.binCode?.toLowerCase().includes(q) ?? false)
      )
    );
  };

  const openSearchModal = async () => {
    setScanInput("");
    setScanError("");
    setScanModal(true);
    setTimeout(() => scanRef.current?.focus(), 250);
    if (allParts.length > 0) {
      setSearchResults(allParts);
      return;
    }
    setPartsLoading(true);
    try {
      const res = await fetch(`${BASE}/parts/items`);
      if (res.ok) {
        const d = await res.json();
        setAllParts(d.items ?? []);
        setSearchResults(d.items ?? []);
      }
    } catch {
      //
    } finally {
      setPartsLoading(false);
    }
  };

  const openLineModal = (item: CartItem) => {
    setLineModal(item);
    setLineEdit({ ...item });
  };

  const saveLineEdit = () => {
    if (!lineEdit) return;
    setCart((prev) => prev.map((c) => c.key === lineEdit.key ? lineEdit : c));
    setLineModal(null);
    setLineEdit(null);
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  };

  const calcLine = (item: CartItem) =>
    calcLineAmounts(
      parseFloat(item.unitPrice) || 0,
      item.qty,
      parseFloat(item.discountPct) || 0,
      parseFloat(item.markupPct) || 0,
      parseFloat(item.vatPct) || 0
    );

  const cartTotals = cart.reduce(
    (acc, item) => {
      const { afterMarkup, vatAmount, lineTotal } = calcLine(item);
      return {
        subtotal: acc.subtotal + afterMarkup,
        totalVat: acc.totalVat + vatAmount,
        grandTotal: acc.grandTotal + lineTotal,
      };
    },
    { subtotal: 0, totalVat: 0, grandTotal: 0 }
  );

  const grandTotalLocal = convertCurrency(cartTotals.grandTotal, currency, localCurrency);

  const submitSale = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim() || null,
        customerRef: customerRef.trim() || null,
        currency,
        exchangeRate,
        localCurrencyCode: localCurrency,
        notes: notes.trim() || null,
        createdBy: userCode,
        items: cart.map((item) => {
          const { afterMarkup } = calcLine(item);
          return {
            partNumber: item.partNumber,
            partName: item.partName,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discountPct: item.discountPct,
            markupPct: item.markupPct,
            vatPct: item.vatPct,
            currency,
          };
        }),
      };
      const res = await fetch(`${BASE}/parts/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const sale = await res.json();
        setInvoiceResult(sale);
        setCart([]);
        setCustomerName("");
        setCustomerRef("");
        setNotes("");
        load();
      }
    } catch {
      //
    } finally {
      setSubmitting(false);
    }
  };

  const resetNewSale = () => {
    setCart([]);
    setCustomerName("");
    setCustomerRef("");
    setNotes("");
    setInvoiceResult(null);
    setMode("list");
  };

  const saleTotal = (sale: SaleRecord) => {
    return sale.items.reduce((acc, item) => {
      const { lineTotal } = calcLineAmounts(
        parseFloat(item.unitPrice) || 0,
        item.qty,
        parseFloat(item.discountPct) || 0,
        parseFloat(item.markupPct) || 0,
        parseFloat(item.vatPct) || 0
      );
      return acc + lineTotal;
    }, 0);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="OTC Sales" subtitle="Counter Sales & Invoicing" showNotifications={false} />

      <View style={styles.modeRow}>
        {(["list", "new"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.modeTab, { borderBottomColor: mode === m ? "#7c3aed" : "transparent", borderBottomWidth: 2 }]}
          >
            <Feather name={m === "list" ? "list" : "plus-circle"} size={14} color={mode === m ? "#7c3aed" : colors.mutedForeground} />
            <Text style={[styles.modeTabText, { color: mode === m ? "#7c3aed" : colors.mutedForeground }]}>
              {m === "list" ? "Sales History" : "New Sale"}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "list" ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        ) : (
          <FlatList
            data={sales}
            keyExtractor={(s) => String(s.id)}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Feather name="shopping-cart" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No sales yet</Text>
                <Pressable style={[styles.emptyBtn, { backgroundColor: "#7c3aed" }]} onPress={() => setMode("new")}>
                  <Text style={styles.emptyBtnText}>Create First Sale</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item: sale }) => {
              const meta = STATUS_META[sale.status] ?? STATUS_META.confirmed;
              const total = saleTotal(sale);
              const sym = CURRENCY_SYMBOLS[sale.currency] ?? sale.currency;
              return (
                <Pressable
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: meta.color }]}
                  onPress={() => setSelectedSale(sale)}
                >
                  <View style={styles.cardRow}>
                    <Text style={[styles.invoiceNum, { color: colors.foreground }]}>{sale.saleNumber}</Text>
                    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text style={[styles.customerText, { color: colors.mutedForeground }]}>
                    {sale.customerName ?? "Walk-in customer"}{sale.customerRef ? ` · ${sale.customerRef}` : ""}
                  </Text>
                  <View style={styles.cardRow}>
                    <Text style={[styles.totalText, { color: colors.foreground }]}>
                      {sym} {total.toFixed(2)}{" "}
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>({sale.currency})</Text>
                    </Text>
                    <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )
      ) : (
        <ScrollView
          contentContainerStyle={[styles.newSaleContent, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Invoice success */}
          {invoiceResult && (
            <View style={[styles.successCard, { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" }]}>
              <Feather name="check-circle" size={28} color="#16a34a" />
              <Text style={[styles.successTitle, { color: "#16a34a" }]}>Invoice Created!</Text>
              <Text style={[styles.successInv, { color: "#15803d" }]}>{invoiceResult.saleNumber}</Text>
              <Pressable style={[styles.doneBtn, { backgroundColor: "#16a34a" }]} onPress={resetNewSale}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          )}

          {!invoiceResult && (
            <>
              {/* Customer section */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Customer (optional)</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                  placeholder="Customer name"
                  placeholderTextColor={colors.mutedForeground}
                  value={customerName}
                  onChangeText={setCustomerName}
                />
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, marginTop: 8 }]}
                  placeholder="Reference / Vehicle reg"
                  placeholderTextColor={colors.mutedForeground}
                  value={customerRef}
                  onChangeText={setCustomerRef}
                />
              </View>

              {/* Currency */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transaction Currency</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyRow}>
                  {CURRENCIES.map((cur) => (
                    <Pressable
                      key={cur}
                      onPress={() => setCurrency(cur)}
                      style={[
                        styles.currencyChip,
                        {
                          backgroundColor: currency === cur ? "#7c3aed" : colors.secondary,
                          borderColor: currency === cur ? "#7c3aed" : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.currencyChipText, { color: currency === cur ? "#fff" : colors.foreground }]}>
                        {cur}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[styles.exchangeNote, { color: colors.mutedForeground }]}>
                  1 {currency} = {getExchangeRate(currency, localCurrency).toFixed(4)} {localCurrency}
                  {" · "}{CURRENCY_NAMES[currency]}
                </Text>
              </View>

              {/* Cart */}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Cart ({cart.length} item{cart.length !== 1 ? "s" : ""})
                  </Text>
                  <Pressable
                    style={[styles.addBtn, { backgroundColor: "#7c3aed20", borderColor: "#7c3aed" }]}
                    onPress={openSearchModal}
                  >
                    <Feather name="plus" size={14} color="#7c3aed" />
                    <Text style={[styles.addBtnText, { color: "#7c3aed" }]}>Add Part</Text>
                  </Pressable>
                </View>

                {cart.length === 0 ? (
                  <View style={styles.emptyCart}>
                    <Feather name="shopping-bag" size={28} color={colors.mutedForeground} />
                    <Text style={[styles.emptyCartText, { color: colors.mutedForeground }]}>Scan or search parts to add</Text>
                  </View>
                ) : (
                  cart.map((item) => {
                    const { afterMarkup, vatAmount, lineTotal } = calcLine(item);
                    const sym = CURRENCY_SYMBOLS[currency] ?? currency;
                    return (
                      <View key={item.key} style={[styles.cartItem, { borderColor: colors.border }]}>
                        <View style={styles.cartItemHeader}>
                          <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                            <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
                          </View>
                          <Pressable onPress={() => removeFromCart(item.key)} hitSlop={8}>
                            <Feather name="trash-2" size={16} color="#ef4444" />
                          </Pressable>
                        </View>
                        <Text style={[styles.cartItemName, { color: colors.foreground }]}>{item.partName}</Text>

                        <View style={styles.cartMetaRow}>
                          <Text style={[styles.cartMeta, { color: colors.mutedForeground }]}>
                            Qty: {item.qty} × {sym}{(parseFloat(item.unitPrice)||0).toFixed(2)}
                          </Text>
                          {parseFloat(item.discountPct) > 0 && (
                            <Text style={[styles.cartMeta, { color: "#dc2626" }]}>-{item.discountPct}% disc</Text>
                          )}
                          {parseFloat(item.markupPct) > 0 && (
                            <Text style={[styles.cartMeta, { color: "#16a34a" }]}>+{item.markupPct}% markup</Text>
                          )}
                          <Text style={[styles.cartMeta, { color: colors.mutedForeground }]}>VAT {item.vatPct}%</Text>
                        </View>

                        <View style={styles.cartItemFooter}>
                          <View>
                            <Text style={[styles.lineTotalLabel, { color: colors.mutedForeground }]}>
                              Net {sym}{afterMarkup.toFixed(2)} + VAT {sym}{vatAmount.toFixed(2)}
                            </Text>
                            <Text style={[styles.lineTotal, { color: colors.foreground }]}>
                              Line total: {sym}{lineTotal.toFixed(2)}
                            </Text>
                          </View>
                          <Pressable
                            style={[styles.editLineBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                            onPress={() => openLineModal(item)}
                          >
                            <Feather name="edit-2" size={14} color={colors.foreground} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Totals */}
              {cart.length > 0 && (
                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Summary</Text>
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Subtotal (excl. VAT)</Text>
                    <Text style={[styles.totalValue, { color: colors.foreground }]}>
                      {formatCurrency(cartTotals.subtotal, currency)}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total VAT</Text>
                    <Text style={[styles.totalValue, { color: "#d97706" }]}>
                      {formatCurrency(cartTotals.totalVat, currency)}
                    </Text>
                  </View>
                  <View style={[styles.totalRow, styles.grandTotalRow]}>
                    <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>Grand Total</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.grandTotalValue, { color: "#7c3aed" }]}>
                        {formatCurrency(cartTotals.grandTotal, currency)}
                      </Text>
                      {currency !== localCurrency && (
                        <Text style={[styles.localAmount, { color: colors.mutedForeground }]}>
                          ≈ {formatCurrency(grandTotalLocal, localCurrency)}
                        </Text>
                      )}
                    </View>
                  </View>

                  <TextInput
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, marginTop: 12 }]}
                    placeholder="Notes (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />

                  <Pressable
                    style={[styles.confirmBtn, { backgroundColor: submitting ? "#7c3aed80" : "#7c3aed" }]}
                    onPress={submitSale}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="file-text" size={18} color="#fff" />
                        <Text style={styles.confirmBtnText}>Create Invoice</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Full-screen Part Search Modal — input stays above keyboard */}
      <Modal visible={scanModal} animationType="slide" onRequestClose={() => setScanModal(false)}>
        <View style={[styles.searchScreen, { backgroundColor: colors.background }]}>
          {/* Fixed header — always above keyboard */}
          <View style={[styles.searchHeader, { backgroundColor: colors.headerBg, borderBottomColor: colors.border, paddingTop: insets.top > 0 ? insets.top : 16 }]}>
            <Pressable onPress={() => setScanModal(false)} style={styles.searchBack} hitSlop={10}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <View style={[styles.searchInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginLeft: 10 }} />
              <TextInput
                ref={scanRef}
                style={[styles.searchInputField, { color: colors.foreground }]}
                placeholder="Search by name, part number or bin…"
                placeholderTextColor={colors.mutedForeground}
                value={scanInput}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {scanInput.length > 0 && (
                <Pressable onPress={() => handleSearchChange("")} hitSlop={8} style={{ marginRight: 10 }}>
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Results count */}
          {!partsLoading && allParts.length > 0 && (
            <View style={[styles.searchCountBar, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
              <Text style={[styles.searchCountText, { color: colors.mutedForeground }]}>
                {scanInput.trim()
                  ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${scanInput.trim()}"`
                  : `${allParts.length} parts — tap to add`}
              </Text>
            </View>
          )}

          {/* Results list — takes all remaining space above keyboard */}
          {partsLoading ? (
            <View style={styles.searchCenter}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <Text style={[styles.searchHint, { color: colors.mutedForeground }]}>Loading inventory…</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(p) => String(p.id)}
              contentContainerStyle={styles.searchList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.searchCenter}>
                  <Feather name="package" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.searchHint, { color: colors.mutedForeground }]}>
                    {scanInput.trim() ? "No parts match your search" : "Start typing to search"}
                  </Text>
                </View>
              }
              renderItem={({ item: part }) => {
                const inCart = cart.some((c) => c.partNumber === part.partNumber);
                const qtyColor = part.qtyOnHand === 0 ? "#ef4444" : part.qtyOnHand < 3 ? "#d97706" : "#16a34a";
                const sym = CURRENCY_SYMBOLS[currency] ?? currency;
                const price = parseFloat(part.unitSalePrice ?? part.unitCost ?? "0");
                return (
                  <Pressable
                    style={[styles.searchResultRow, { backgroundColor: inCart ? "#7c3aed08" : colors.card, borderColor: inCart ? "#7c3aed40" : colors.border }]}
                    onPress={() => addPartToCart(part)}
                  >
                    <View style={styles.searchResultLeft}>
                      <View style={styles.searchResultTopRow}>
                        <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                          <Text style={[styles.pnText, { color: "#7c3aed" }]}>{part.partNumber}</Text>
                        </View>
                        {part.binCode && (
                          <View style={[styles.binChip, { backgroundColor: colors.secondary }]}>
                            <Feather name="grid" size={10} color={colors.mutedForeground} />
                            <Text style={[styles.binChipText, { color: colors.mutedForeground }]}>{part.binCode}</Text>
                          </View>
                        )}
                        {inCart && (
                          <View style={[styles.inCartBadge, { backgroundColor: "#7c3aed20" }]}>
                            <Feather name="check" size={10} color="#7c3aed" />
                            <Text style={[styles.inCartText, { color: "#7c3aed" }]}>In cart</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.searchResultName, { color: colors.foreground }]} numberOfLines={1}>{part.name}</Text>
                      <Text style={[styles.searchResultMeta, { color: colors.mutedForeground }]}>{part.category}</Text>
                    </View>
                    <View style={styles.searchResultRight}>
                      <Text style={[styles.searchResultPrice, { color: colors.foreground }]}>{sym}{price.toFixed(2)}</Text>
                      <Text style={[styles.searchResultQty, { color: qtyColor }]}>Qty: {part.qtyOnHand}</Text>
                      <View style={[styles.addIconBtn, { backgroundColor: inCart ? "#7c3aed20" : "#7c3aed" }]}>
                        <Feather name={inCart ? "plus" : "plus"} size={16} color={inCart ? "#7c3aed" : "#fff"} />
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* Line Edit Modal */}
      <Modal visible={!!lineModal} animationType="slide" transparent onRequestClose={() => setLineModal(null)}>
        <View style={styles.scanOverlay}>
          {lineEdit && (
            <View style={[styles.lineBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.scanHeader}>
                <Text style={[styles.scanTitle, { color: colors.foreground }]} numberOfLines={1}>{lineEdit.partName}</Text>
                <Pressable onPress={() => setLineModal(null)}>
                  <Feather name="x" size={22} color={colors.foreground} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Qty */}
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Quantity</Text>
                <View style={styles.qtyRow}>
                  <Pressable style={[styles.qtyBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={() => setLineEdit((e) => e ? { ...e, qty: Math.max(1, e.qty - 1) } : e)}>
                    <Feather name="minus" size={16} color={colors.foreground} />
                  </Pressable>
                  <TextInput
                    style={[styles.qtyInput, { color: colors.foreground, borderColor: colors.border }]}
                    value={String(lineEdit.qty)}
                    onChangeText={(v) => setLineEdit((e) => e ? { ...e, qty: parseInt(v) || 1 } : e)}
                    keyboardType="number-pad"
                  />
                  <Pressable style={[styles.qtyBtn, { backgroundColor: "#7c3aed20", borderColor: "#7c3aed" }]} onPress={() => setLineEdit((e) => e ? { ...e, qty: e.qty + 1 } : e)}>
                    <Feather name="plus" size={16} color="#7c3aed" />
                  </Pressable>
                </View>

                {[
                  { label: "Unit Price", key: "unitPrice" as const, hint: CURRENCY_SYMBOLS[currency] },
                  { label: "Discount %", key: "discountPct" as const, hint: "%" },
                  { label: "Markup %", key: "markupPct" as const, hint: "%" },
                  { label: "VAT %", key: "vatPct" as const, hint: "%" },
                ].map(({ label, key, hint }) => (
                  <View key={key}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                    <View style={[styles.inputWithSuffix, { borderColor: colors.border }]}>
                      <TextInput
                        style={[styles.inputInner, { color: colors.foreground }]}
                        value={lineEdit[key]}
                        onChangeText={(v) => setLineEdit((e) => e ? { ...e, [key]: v } : e)}
                        keyboardType="decimal-pad"
                      />
                      <Text style={[styles.inputSuffix, { color: colors.mutedForeground }]}>{hint}</Text>
                    </View>
                  </View>
                ))}

                {/* Live breakdown */}
                {(() => {
                  const { base, afterDiscount, afterMarkup, vatAmount, lineTotal } = calcLineAmounts(
                    parseFloat(lineEdit.unitPrice) || 0,
                    lineEdit.qty,
                    parseFloat(lineEdit.discountPct) || 0,
                    parseFloat(lineEdit.markupPct) || 0,
                    parseFloat(lineEdit.vatPct) || 0
                  );
                  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
                  return (
                    <View style={[styles.breakdown, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Text style={[styles.breakdownTitle, { color: colors.foreground }]}>Line Breakdown</Text>
                      {[
                        ["Base", `${sym}${base.toFixed(2)}`],
                        ["After Discount", `${sym}${afterDiscount.toFixed(2)}`],
                        ["After Markup", `${sym}${afterMarkup.toFixed(2)}`],
                        ["VAT", `${sym}${vatAmount.toFixed(2)}`],
                        ["Line Total", `${sym}${lineTotal.toFixed(2)}`],
                      ].map(([label, val], i) => (
                        <View key={i} style={styles.breakdownRow}>
                          <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>{label}</Text>
                          <Text style={[styles.breakdownVal, { color: i === 4 ? "#7c3aed" : colors.foreground, fontFamily: i === 4 ? "Inter_700Bold" : "Inter_500Medium" }]}>{val}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                <Pressable style={[styles.confirmBtn, { backgroundColor: "#7c3aed" }]} onPress={saveLineEdit}>
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.confirmBtnText}>Save Line</Text>
                </Pressable>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* Sale Detail Modal */}
      <Modal visible={!!selectedSale} animationType="slide" onRequestClose={() => setSelectedSale(null)}>
        {selectedSale && (
          <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.detailHeader, { borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
              <Pressable onPress={() => setSelectedSale(null)} style={styles.backBtn}>
                <Feather name="x" size={22} color={colors.foreground} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailTitle, { color: colors.foreground }]}>{selectedSale.saleNumber}</Text>
                <Text style={[styles.detailSub, { color: colors.mutedForeground }]}>
                  {selectedSale.customerName ?? "Walk-in"} · {new Date(selectedSale.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 20, gap: 10 }}>
              {selectedSale.items.map((item) => {
                const { afterMarkup, vatAmount, lineTotal } = calcLineAmounts(
                  parseFloat(item.unitPrice)||0, item.qty,
                  parseFloat(item.discountPct)||0, parseFloat(item.markupPct)||0, parseFloat(item.vatPct)||0
                );
                const sym = CURRENCY_SYMBOLS[selectedSale.currency] ?? selectedSale.currency;
                return (
                  <View key={item.id} style={[styles.cartItem, { borderColor: colors.border }]}>
                    <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                      <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
                    </View>
                    <Text style={[styles.cartItemName, { color: colors.foreground }]}>{item.partName}</Text>
                    <Text style={[styles.cartMeta, { color: colors.mutedForeground }]}>
                      Qty: {item.qty} · Discount: {item.discountPct}% · Markup: {item.markupPct}% · VAT: {item.vatPct}%
                    </Text>
                    <Text style={[styles.lineTotal, { color: colors.foreground }]}>
                      Net {sym}{afterMarkup.toFixed(2)} + VAT {sym}{vatAmount.toFixed(2)} = {sym}{lineTotal.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {(() => {
                  const grand = saleTotal(selectedSale);
                  const sym = CURRENCY_SYMBOLS[selectedSale.currency] ?? selectedSale.currency;
                  const localSym = CURRENCY_SYMBOLS[selectedSale.localCurrencyCode] ?? selectedSale.localCurrencyCode;
                  const rate = parseFloat(selectedSale.exchangeRate) || 1;
                  return (
                    <>
                      <View style={styles.totalRow}>
                        <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>Grand Total</Text>
                        <Text style={[styles.grandTotalValue, { color: "#7c3aed" }]}>{sym} {grand.toFixed(2)}</Text>
                      </View>
                      {selectedSale.currency !== selectedSale.localCurrencyCode && (
                        <Text style={[styles.localAmount, { color: colors.mutedForeground }]}>
                          ≈ {localSym} {(grand * rate).toFixed(2)} {selectedSale.localCurrencyCode}
                        </Text>
                      )}
                    </>
                  );
                })()}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  modeRow: { flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "transparent" },
  modeTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  modeTabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  list: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  card: { borderRadius: 10, borderWidth: 1, borderLeftWidth: 4, padding: 13, gap: 4 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  invoiceNum: { fontSize: 15, fontFamily: "Inter_700Bold" },
  customerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  totalText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dateText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  newSaleContent: { padding: 16, gap: 12 },
  section: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  currencyRow: { gap: 8, paddingVertical: 4 },
  currencyChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  currencyChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  exchangeNote: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyCart: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyCartText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  cartItem: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
  cartItemHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pnBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pnText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  cartItemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  cartMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cartMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cartItemFooter: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 },
  lineTotalLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  lineTotal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  editLineBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  totalValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  grandTotalRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e2e8f0", marginTop: 4 },
  grandTotalLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  grandTotalValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  localAmount: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "right" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, padding: 14, marginTop: 4 },
  confirmBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  successCard: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: "center", gap: 10 },
  successTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  successInv: { fontSize: 26, fontFamily: "Inter_700Bold" },
  doneBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  doneBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  // Line-edit modal (keeps bottom-sheet style)
  scanOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  lineBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, maxHeight: "85%", gap: 12 },
  scanHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scanTitle: { fontSize: 17, fontFamily: "Inter_700Bold", flex: 1, marginRight: 8 },
  // Full-screen part search modal
  searchScreen: { flex: 1 },
  searchHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  searchBack: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  searchInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, height: 44 },
  searchInputField: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingHorizontal: 10, height: "100%" },
  searchCountBar: { paddingHorizontal: 16, paddingVertical: 7, borderBottomWidth: 1 },
  searchCountText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  searchList: { padding: 12, gap: 10, paddingBottom: 40 },
  searchCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, minHeight: 300 },
  searchHint: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  searchResultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  searchResultLeft: { flex: 1, gap: 3 },
  searchResultTopRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  searchResultName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  searchResultMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  searchResultRight: { alignItems: "flex-end", gap: 4 },
  searchResultPrice: { fontSize: 15, fontFamily: "Inter_700Bold" },
  searchResultQty: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  addIconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 2 },
  binChip: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  binChipText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  inCartBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  inCartText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4, marginTop: 8 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyInput: { width: 60, height: 38, borderWidth: 1, borderRadius: 8, textAlign: "center", fontSize: 16, fontFamily: "Inter_700Bold" },
  inputWithSuffix: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  inputInner: { flex: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  inputSuffix: { paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  breakdown: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  breakdownTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  breakdownVal: { fontSize: 13 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: Platform.OS === "ios" ? 60 : 24, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  detailTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  detailSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
