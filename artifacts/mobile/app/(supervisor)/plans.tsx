import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState, useCallback } from "react";
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

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

interface PlanSlot {
  id: number;
  packageName: string;
  slotOrder: number;
  redeemed: boolean;
}

interface ServicePlan {
  id: number;
  planNumber: string;
  name: string;
  vin: string;
  vehicleLabel: string | null;
  status: "active" | "exhausted" | "cancelled";
  expiryDate: string | null;
  maxMileage: number | null;
  slots: PlanSlot[];
  totalSlots: number;
  usedSlots: number;
  remainingSlots: number;
}

interface LookupResult {
  plans: ServicePlan[];
  summary: {
    total: number;
    active: number;
    exhausted: number;
    cancelled: number;
    totalRemainingSlots: number;
  };
}

const STATUS_CONFIG = {
  active:    { color: "#16a34a", bg: "#dcfce7", label: "Active",    icon: "check-circle" as const },
  exhausted: { color: "#64748b", bg: "#f1f5f9", label: "Exhausted", icon: "x-circle"     as const },
  cancelled: { color: "#ef4444", bg: "#fee2e2", label: "Cancelled", icon: "slash"         as const },
};

function PlanCard({ plan }: { plan: ServicePlan }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[plan.status];

  const expiryDate = plan.expiryDate ? new Date(plan.expiryDate) : null;
  const isExpired = expiryDate !== null && expiryDate < new Date();

  return (
    <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        onPress={() => { setExpanded((v) => !v); Haptics.selectionAsync(); }}
        style={styles.planCardHeader}
      >
        <View style={[styles.planNumberBadge, { backgroundColor: colors.accent }]}>
          <Feather name="credit-card" size={13} color={colors.primary} />
          <Text style={[styles.planNumber, { color: colors.primary }]}>{plan.planNumber}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon} size={11} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </Pressable>

      <View style={styles.planMeta}>
        <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
        {plan.vehicleLabel ? (
          <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>
            <Feather name="truck" size={11} color={colors.mutedForeground} /> {plan.vehicleLabel}
          </Text>
        ) : null}
        <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>
          <Feather name="hash" size={11} color={colors.mutedForeground} /> VIN: {plan.vin}
        </Text>
      </View>

      <View style={[styles.slotsRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        <View style={styles.slotStat}>
          <Text style={[styles.slotStatValue, { color: colors.primary }]}>{plan.remainingSlots}</Text>
          <Text style={[styles.slotStatLabel, { color: colors.mutedForeground }]}>Remaining</Text>
        </View>
        <View style={[styles.slotDivider, { backgroundColor: colors.border }]} />
        <View style={styles.slotStat}>
          <Text style={[styles.slotStatValue, { color: "#64748b" }]}>{plan.usedSlots}</Text>
          <Text style={[styles.slotStatLabel, { color: colors.mutedForeground }]}>Used</Text>
        </View>
        <View style={[styles.slotDivider, { backgroundColor: colors.border }]} />
        <View style={styles.slotStat}>
          <Text style={[styles.slotStatValue, { color: colors.foreground }]}>{plan.totalSlots}</Text>
          <Text style={[styles.slotStatLabel, { color: colors.mutedForeground }]}>Total</Text>
        </View>
      </View>

      <View style={styles.slotBar}>
        {plan.slots.map((slot) => (
          <View
            key={slot.id}
            style={[
              styles.slotBarSegment,
              {
                backgroundColor: slot.redeemed
                  ? "#64748b"
                  : plan.status === "active" ? "#16a34a" : "#d1d5db",
              },
            ]}
          />
        ))}
      </View>

      {(expiryDate || plan.maxMileage) && (
        <View style={styles.constraintRow}>
          {expiryDate ? (
            <View style={[styles.constraintPill, { backgroundColor: isExpired ? "#fee2e2" : colors.secondary }]}>
              <Feather name="calendar" size={11} color={isExpired ? "#ef4444" : colors.mutedForeground} />
              <Text style={[styles.constraintText, { color: isExpired ? "#ef4444" : colors.mutedForeground }]}>
                {isExpired ? "Expired " : "Expires "}
                {expiryDate.toLocaleDateString()}
              </Text>
            </View>
          ) : null}
          {plan.maxMileage ? (
            <View style={[styles.constraintPill, { backgroundColor: colors.secondary }]}>
              <Feather name="navigation" size={11} color={colors.mutedForeground} />
              <Text style={[styles.constraintText, { color: colors.mutedForeground }]}>
                Max {plan.maxMileage.toLocaleString()} km
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <Pressable
        onPress={() => { setExpanded((v) => !v); Haptics.selectionAsync(); }}
        style={styles.expandToggle}
      >
        <Text style={[styles.expandToggleText, { color: colors.primary }]}>
          {expanded ? "Hide services" : "Show included services"}
        </Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
      </Pressable>

      {expanded && (
        <View style={[styles.slotList, { borderTopColor: colors.border }]}>
          {plan.slots.map((slot, idx) => (
            <View
              key={slot.id}
              style={[
                styles.slotItem,
                idx < plan.slots.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
              ]}
            >
              <View style={[styles.slotDot, { backgroundColor: slot.redeemed ? "#64748b" : "#16a34a" }]} />
              <Text style={[styles.slotItemName, { color: colors.foreground, flex: 1 }]}>
                {slot.packageName}
              </Text>
              <View style={[styles.slotBadge, { backgroundColor: slot.redeemed ? "#f1f5f9" : "#dcfce7" }]}>
                <Feather
                  name={slot.redeemed ? "check" : "circle"}
                  size={12}
                  color={slot.redeemed ? "#64748b" : "#16a34a"}
                />
                <Text style={[styles.slotBadgeText, { color: slot.redeemed ? "#64748b" : "#16a34a" }]}>
                  {slot.redeemed ? "Used" : "Available"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PlanLookupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"vin" | "plan">("vin");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const param = mode === "vin" ? `vin=${encodeURIComponent(q)}` : `planNumber=${encodeURIComponent(q)}`;
      const res = await fetch(`${BASE}/service-plans/lookup?${param}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lookup failed");
      } else {
        setResult(data as LookupResult);
      }
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [query, mode]);

  const clear = () => {
    setQuery("");
    setResult(null);
    setError(null);
    setSearched(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Plan Lookup" subtitle="Check service plan history &amp; remaining slots" />

      <View style={[styles.searchArea, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.modeRow}>
          {(["vin", "plan"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => { setMode(m); Haptics.selectionAsync(); }}
              style={[styles.modeTab, mode === m && { borderBottomColor: colors.primary }]}
            >
              <Text style={[styles.modeTabText, { color: mode === m ? colors.primary : colors.mutedForeground }]}>
                {m === "vin" ? "Search by VIN" : "Search by Plan #"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name={mode === "vin" ? "truck" : "credit-card"} size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder={mode === "vin" ? "Enter VIN (e.g. 1HGBH41JXMN109186)" : "Enter plan number (e.g. SP-2026-ABCD)"}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              autoCapitalize="characters"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={clear}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={search}
            disabled={loading || !query.trim()}
            style={[styles.searchBtn, { backgroundColor: colors.primary, opacity: !query.trim() ? 0.5 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="search" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: "#fee2e2", borderColor: "#fca5a5" }]}>
            <Feather name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {result && (
          <>
            <View style={styles.summaryRow}>
              {[
                { label: "Active Plans",  value: result.summary.active,              color: "#16a34a", bg: "#dcfce7" },
                { label: "Slots Left",    value: result.summary.totalRemainingSlots, color: "#2563eb", bg: "#dbeafe" },
                { label: "Total Plans",   value: result.summary.total,               color: "#64748b", bg: "#f1f5f9" },
              ].map(({ label, value, color, bg }) => (
                <View key={label} style={[styles.summaryCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
                  <View style={[styles.summaryIcon, { backgroundColor: bg }]}>
                    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
                  </View>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
                </View>
              ))}
            </View>

            {result.plans.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="inbox" size={44} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No plans found</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No service plans match that {mode === "vin" ? "VIN" : "plan number"}.
                </Text>
              </View>
            ) : (
              result.plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)
            )}
          </>
        )}

        {!searched && !loading && (
          <View style={styles.placeholder}>
            <View style={[styles.placeholderIcon, { backgroundColor: colors.accent }]}>
              <Feather name="credit-card" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.placeholderTitle, { color: colors.foreground }]}>Service Plan Lookup</Text>
            <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
              Enter a vehicle VIN or plan number to view prepaid service history and remaining slots.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:           { flex: 1 },
  searchArea:       { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 12 },
  modeRow:          { flexDirection: "row", marginBottom: 10 },
  modeTab:          { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  modeTabText:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputRow:         { flexDirection: "row", gap: 10 },
  inputWrap:        { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10 },
  input:            { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  searchBtn:        { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  scroll:           { flex: 1 },
  content:          { padding: 16, gap: 14 },

  errorBanner:      { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  errorText:        { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#ef4444" },

  summaryRow:       { flexDirection: "row", gap: 8, marginBottom: 4 },
  summaryCard:      { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 6, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  summaryIcon:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  summaryValue:     { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLabel:     { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },

  planCard:         { borderRadius: 16, borderWidth: 1.5, overflow: "hidden" },
  planCardHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, paddingBottom: 10 },
  planNumberBadge:  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  planNumber:       { fontSize: 13, fontFamily: "Inter_700Bold" },
  statusPill:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  statusText:       { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  planMeta:         { paddingHorizontal: 14, paddingBottom: 12, gap: 3 },
  planName:         { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  planDetail:       { fontSize: 12, fontFamily: "Inter_400Regular" },

  slotsRow:         { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1 },
  slotStat:         { flex: 1, alignItems: "center", paddingVertical: 12, gap: 2 },
  slotStatValue:    { fontSize: 22, fontFamily: "Inter_700Bold" },
  slotStatLabel:    { fontSize: 11, fontFamily: "Inter_400Regular" },
  slotDivider:      { width: 1 },

  slotBar:          { flexDirection: "row", gap: 3, padding: 12 },
  slotBarSegment:   { flex: 1, height: 6, borderRadius: 3 },

  constraintRow:    { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 10, flexWrap: "wrap" },
  constraintPill:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  constraintText:   { fontSize: 11, fontFamily: "Inter_400Regular" },

  expandToggle:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, paddingTop: 4 },
  expandToggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  slotList:         { borderTopWidth: 1 },
  slotItem:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  slotDot:          { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  slotItemName:     { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  slotBadge:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  slotBadgeText:    { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  placeholder:      { alignItems: "center", paddingVertical: 60, gap: 14 },
  placeholderIcon:  { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  placeholderTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  placeholderText:  { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 280, lineHeight: 20 },

  empty:            { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle:       { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText:        { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260, color: "#64748b" },
});
