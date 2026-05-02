import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

interface PartItem {
  id: number;
  partNumber: string;
  name: string;
  category: string;
  description: string | null;
  binCode: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  minStock: number;
  maxStock: number;
  unitCost: string | null;
  supplierCode: string | null;
  lastCountedAt: string | null;
  createdAt: string;
}

export default function PartItemDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [item, setItem] = useState<PartItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [binEdit, setBinEdit] = useState("");
  const [qtyAdjust, setQtyAdjust] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${BASE}/parts/items/${id}`);
      if (res.ok) {
        const d = await res.json();
        setItem(d);
        setBinEdit(d.binCode ?? "");
        setQtyAdjust(String(d.qtyOnHand));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveChanges = async () => {
    if (!item) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${BASE}/parts/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          binCode: binEdit || null,
          qtyOnHand: parseInt(qtyAdjust) || item.qtyOnHand,
          adjustNote: adjustNote || undefined,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setItem(d);
        setEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const qtyStatus = (it: PartItem) => {
    if (it.qtyOnHand === 0) return { color: "#dc2626", bg: "#fef2f2", label: "Out of Stock" };
    if (it.qtyOnHand < it.minStock) return { color: "#d97706", bg: "#fef3c7", label: "Low Stock" };
    return { color: "#16a34a", bg: "#dcfce7", label: "In Stock" };
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBg, paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item?.name ?? "Part Detail"}
          </Text>
          {item && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{item.partNumber}</Text>
          )}
        </View>
        {item && !editing && (
          <Pressable
            style={[styles.editBtn, { backgroundColor: "#7c3aed20", borderColor: "#7c3aed" }]}
            onPress={() => setEditing(true)}
          >
            <Feather name="edit-2" size={14} color="#7c3aed" />
            <Text style={[styles.editBtnText, { color: "#7c3aed" }]}>Edit</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : !item ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
          <Text style={[styles.notFound, { color: colors.mutedForeground }]}>Part not found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {saveSuccess && (
            <View style={[styles.successBanner, { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" }]}>
              <Feather name="check-circle" size={16} color="#16a34a" />
              <Text style={[styles.successText, { color: "#16a34a" }]}>Changes saved successfully</Text>
            </View>
          )}

          {(() => {
            const s = qtyStatus(item);
            return (
              <View style={[styles.statusCard, { backgroundColor: s.bg, borderColor: s.color + "40" }]}>
                <View style={[styles.statusBadge, { backgroundColor: s.color + "20" }]}>
                  <Text style={[styles.statusLabel, { color: s.color }]}>{s.label}</Text>
                </View>
                <Text style={[styles.bigQty, { color: s.color }]}>{item.qtyOnHand}</Text>
                <Text style={[styles.bigQtyLabel, { color: s.color }]}>units in stock</Text>
              </View>
            );
          })()}

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>
          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Row label="Part Number" value={item.partNumber} colors={colors} mono />
            <Row label="Category" value={item.category} colors={colors} />
            {item.description && <Row label="Description" value={item.description} colors={colors} />}
            {item.supplierCode && <Row label="Supplier" value={item.supplierCode} colors={colors} />}
            {item.unitCost && <Row label="Unit Cost" value={`$${parseFloat(item.unitCost).toFixed(2)}`} colors={colors} />}
            <Row label="Last Counted" value={item.lastCountedAt ? new Date(item.lastCountedAt).toLocaleDateString() : "Never"} colors={colors} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Stock Levels</Text>
          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stockGrid}>
              <StockTile label="On Hand" value={item.qtyOnHand} color={item.qtyOnHand < item.minStock ? "#dc2626" : "#16a34a"} colors={colors} />
              <StockTile label="Reserved" value={item.qtyReserved} color="#1d4ed8" colors={colors} />
              <StockTile label="Available" value={Math.max(0, item.qtyOnHand - item.qtyReserved)} color="#7c3aed" colors={colors} />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.stockGrid}>
              <StockTile label="Minimum" value={item.minStock} color={colors.mutedForeground} colors={colors} />
              <StockTile label="Maximum" value={item.maxStock} color={colors.mutedForeground} colors={colors} />
              <StockTile label="To Reorder" value={Math.max(0, item.maxStock - item.qtyOnHand)} color={item.qtyOnHand < item.minStock ? "#dc2626" : colors.mutedForeground} colors={colors} />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Bin Location</Text>
          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {editing ? (
              <TextInput
                style={[styles.binInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={binEdit}
                onChangeText={setBinEdit}
                placeholder="Enter bin code (e.g. A1, B12)"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
              />
            ) : item.binCode ? (
              <View style={styles.binDisplay}>
                <Feather name="grid" size={24} color="#7c3aed" />
                <View>
                  <Text style={[styles.binCode, { color: "#7c3aed" }]}>{item.binCode}</Text>
                  <Text style={[styles.binLabel, { color: colors.mutedForeground }]}>Bin location</Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.noBin, { color: colors.mutedForeground }]}>No bin assigned — tap Edit to set a location</Text>
            )}
          </View>

          {editing && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Adjust Quantity</Text>
              <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.binInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={qtyAdjust}
                  onChangeText={setQtyAdjust}
                  keyboardType="number-pad"
                  placeholder="New quantity on hand"
                  placeholderTextColor={colors.mutedForeground}
                />
                <TextInput
                  style={[styles.binInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, marginTop: 8 }]}
                  value={adjustNote}
                  onChangeText={setAdjustNote}
                  placeholder="Reason for adjustment (optional)"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.editActions}>
                <Pressable
                  style={[styles.cancelEditBtn, { borderColor: colors.border }]}
                  onPress={() => { setEditing(false); setBinEdit(item.binCode ?? ""); setQtyAdjust(String(item.qtyOnHand)); }}
                >
                  <Text style={[styles.cancelEditText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, { backgroundColor: saving ? "#7c3aed80" : "#7c3aed" }]}
                  onPress={saveChanges}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value, colors, mono }: { label: string; value: string; colors: any; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground, fontFamily: mono ? "Inter_700Bold" : "Inter_500Medium" }]}>{value}</Text>
    </View>
  );
}

function StockTile({ label, value, color, colors }: { label: string; value: number; color: string; colors: any }) {
  return (
    <View style={styles.stockTile}>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  notFound: { fontSize: 16, fontFamily: "Inter_400Regular" },
  content: { padding: 16, gap: 10 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  successText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  statusCard: { borderRadius: 12, borderWidth: 1, padding: 20, alignItems: "center", gap: 4 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  statusLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  bigQty: { fontSize: 52, fontFamily: "Inter_700Bold", lineHeight: 60 },
  bigQtyLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 10 },
  detailCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rowLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 13, flex: 1, textAlign: "right" },
  stockGrid: { flexDirection: "row", gap: 0 },
  stockTile: { flex: 1, alignItems: "center", gap: 3 },
  tileValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  tileLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginVertical: 4 },
  binDisplay: { flexDirection: "row", alignItems: "center", gap: 12 },
  binCode: { fontSize: 24, fontFamily: "Inter_700Bold" },
  binLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  noBin: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", padding: 8 },
  binInput: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  editActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelEditBtn: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "center" },
  cancelEditText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  saveBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
