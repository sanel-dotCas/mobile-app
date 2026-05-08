import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanSlot {
  id: number;
  planId: number;
  packageId: number;
  packageName: string;
  slotOrder: number;
  redeemedAt: string | null;
  redeemedOnEstimate: string | null;
  redeemedBy: string | null;
}

interface ServicePlan {
  id: number;
  planNumber: string;
  name: string;
  vin: string;
  vehicleLabel: string | null;
  customerName: string | null;
  totalPrice: string;
  soldBy: string | null;
  status: "active" | "exhausted" | "cancelled";
  notes: string | null;
  slots: PlanSlot[];
  totalSlots: number;
  usedSlots: number;
  remainingSlots: number;
  createdAt: string;
}

interface ServicePackage {
  id: number;
  name: string;
  color: string;
  icon: string;
  vehicleModel: string | null;
  serviceInterval: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { color: "#16a34a", bg: "#dcfce7", label: "Active" },
  exhausted: { color: "#64748b", bg: "#f1f5f9", label: "Exhausted" },
  cancelled: { color: "#dc2626", bg: "#fef2f2", label: "Cancelled" },
};

function formatPrice(val: string | number | null | undefined) {
  const n = Number(val);
  if (isNaN(n)) return "R0.00";
  return `R${n.toFixed(2)}`;
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onDelete,
  onCancel,
}: {
  plan: ServicePlan;
  onDelete: (id: number) => void;
  onCancel: (id: number) => void;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[plan.status];
  const progress = plan.totalSlots > 0 ? plan.usedSlots / plan.totalSlots : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.cardAccent, { backgroundColor: plan.status === "active" ? "#16a34a" : plan.status === "cancelled" ? "#dc2626" : "#94a3b8" }]} />

      <Pressable style={styles.cardMain} onPress={() => setExpanded((e) => !e)}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleBlock}>
            <Text style={[styles.planName, { color: colors.foreground }]} numberOfLines={1}>{plan.name}</Text>
            <Text style={[styles.planNumber, { color: colors.mutedForeground }]}>{plan.planNumber}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </View>

        {/* VIN + customer row */}
        <View style={styles.infoRow}>
          <Feather name="key" size={11} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            {plan.vin}{plan.vehicleLabel ? ` · ${plan.vehicleLabel}` : ""}
          </Text>
        </View>
        {plan.customerName ? (
          <View style={styles.infoRow}>
            <Feather name="user" size={11} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{plan.customerName}</Text>
          </View>
        ) : null}

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: colors.accent }]}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as `${number}%`, backgroundColor: plan.status === "active" ? "#16a34a" : "#94a3b8" }]} />
          </View>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
            {plan.usedSlots}/{plan.totalSlots} services used
          </Text>
          <Text style={[styles.priceText, { color: colors.foreground }]}>{formatPrice(plan.totalPrice)}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={[styles.expandedBody, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SERVICES INCLUDED</Text>
          {plan.slots.map((slot) => (
            <View key={slot.id} style={[styles.slotRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.slotDot, { backgroundColor: slot.redeemedAt ? "#94a3b8" : "#16a34a" }]} />
              <Text style={[styles.slotName, { color: slot.redeemedAt ? colors.mutedForeground : colors.foreground }]}>
                {slot.packageName}
              </Text>
              {slot.redeemedAt ? (
                <View style={styles.redeemedBadge}>
                  <Feather name="check" size={10} color="#64748b" />
                  <Text style={styles.redeemedText}>
                    Used{slot.redeemedOnEstimate ? ` · ${slot.redeemedOnEstimate}` : ""}
                  </Text>
                </View>
              ) : (
                <View style={styles.availableBadge}>
                  <Text style={styles.availableText}>Available</Text>
                </View>
              )}
            </View>
          ))}

          {plan.notes ? (
            <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{plan.notes}</Text>
          ) : null}

          <View style={styles.cardActions}>
            {plan.status === "active" && (
              <Pressable style={styles.cancelBtn} onPress={() => onCancel(plan.id)}>
                <Feather name="x-circle" size={13} color="#d97706" />
                <Text style={styles.cancelBtnText}>Cancel Plan</Text>
              </Pressable>
            )}
            <Pressable style={styles.deleteBtn} onPress={() => onDelete(plan.id)}>
              <Feather name="trash-2" size={13} color="#dc2626" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Create plan modal ─────────────────────────────────────────────────────────

function CreatePlanModal({
  visible,
  onClose,
  onCreated,
  packages,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (plan: ServicePlan) => void;
  packages: ServicePackage[];
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userCode, locationId } = useAuth();

  const [name, setName] = useState("");
  const [vin, setVin] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [pkgSearch, setPkgSearch] = useState("");

  const reset = () => {
    setName(""); setVin(""); setVehicleLabel(""); setCustomerName("");
    setTotalPrice(""); setNotes(""); setSelectedIds([]); setPkgSearch("");
  };

  const togglePkg = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredPkgs = packages.filter((p) => {
    if (!pkgSearch.trim()) return true;
    const q = pkgSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.vehicleModel ?? "").toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert("Validation", "Plan name is required"); return; }
    if (!vin.trim() || vin.trim().length < 5) { Alert.alert("Validation", "VIN is required (min 5 characters)"); return; }
    if (selectedIds.length === 0) { Alert.alert("Validation", "Select at least one service package"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/service-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          vin: vin.trim().toUpperCase(),
          vehicleLabel: vehicleLabel.trim() || null,
          customerName: customerName.trim() || null,
          totalPrice: totalPrice.trim() || "0",
          soldBy: userCode ?? "admin",
          locationId: locationId || null,
          notes: notes.trim() || null,
          packageIds: selectedIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        Alert.alert("Error", err.error ?? "Could not create plan");
        return;
      }
      const plan = await res.json() as ServicePlan;
      onCreated(plan);
      reset();
      onClose();
    } catch {
      Alert.alert("Error", "Could not create plan. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const totalCalc = selectedIds.reduce((sum, id) => {
    const pkg = packages.find((p) => p.id === id);
    return sum; // price calculated from totalPrice field — user enters it
  }, 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[createStyles.container, { backgroundColor: colors.background }]}>
          <View style={[createStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
            <Pressable onPress={() => { reset(); onClose(); }} style={createStyles.headerBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={[createStyles.headerTitle, { color: colors.foreground }]}>New Prepaid Plan</Text>
            <Pressable onPress={handleCreate} style={[createStyles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={createStyles.saveBtnText}>Create</Text>}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[createStyles.scroll, { paddingBottom: insets.bottom + 32 }]}>
            {/* Plan details */}
            <Text style={[createStyles.sectionLabel, { color: colors.mutedForeground }]}>PLAN DETAILS</Text>
            <View style={[createStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: "Plan Name *", value: name, set: setName, placeholder: "e.g. RAM 3-Year Service Plan" },
                { label: "VIN *", value: vin, set: (v: string) => setVin(v.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "")), placeholder: "17-character VIN", autoCapitalize: "characters" as const, maxLength: 17 },
                { label: "Vehicle (make/model/year)", value: vehicleLabel, set: setVehicleLabel, placeholder: "e.g. 2024 RAM 1500 Rebel" },
                { label: "Customer Name", value: customerName, set: setCustomerName, placeholder: "Customer full name" },
                { label: "Total Price Paid (R)", value: totalPrice, set: setTotalPrice, placeholder: "0.00", keyboardType: "decimal-pad" as const },
                { label: "Notes", value: notes, set: setNotes, placeholder: "Any notes about this plan…" },
              ].map(({ label, value, set, placeholder, ...rest }, i, arr) => (
                <View key={label} style={[createStyles.field, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={[createStyles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    style={[createStyles.fieldInput, { color: colors.foreground }]}
                    value={value}
                    onChangeText={set}
                    placeholder={placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    {...rest}
                  />
                </View>
              ))}
            </View>

            {/* Package selection */}
            <Text style={[createStyles.sectionLabel, { color: colors.mutedForeground }]}>
              SELECT SERVICES ({selectedIds.length} selected)
            </Text>
            <View style={[createStyles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[createStyles.searchInput, { color: colors.foreground }]}
                placeholder="Search packages…"
                placeholderTextColor={colors.mutedForeground}
                value={pkgSearch}
                onChangeText={setPkgSearch}
              />
            </View>

            {filteredPkgs.map((pkg) => {
              const selected = selectedIds.includes(pkg.id);
              const count = selectedIds.filter((x) => x === pkg.id).length;
              return (
                <Pressable
                  key={pkg.id}
                  style={[
                    createStyles.pkgRow,
                    { backgroundColor: colors.card, borderColor: selected ? pkg.color : colors.border },
                    selected && { borderWidth: 1.5 },
                  ]}
                  onPress={() => togglePkg(pkg.id)}
                >
                  <View style={[createStyles.pkgDot, { backgroundColor: pkg.color }]} />
                  <View style={createStyles.pkgInfo}>
                    <Text style={[createStyles.pkgName, { color: colors.foreground }]} numberOfLines={1}>{pkg.name}</Text>
                    {(pkg.vehicleModel || pkg.serviceInterval) ? (
                      <Text style={[createStyles.pkgSub, { color: colors.mutedForeground }]}>
                        {[pkg.vehicleModel, pkg.serviceInterval].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <View style={[createStyles.checkBadge, { backgroundColor: pkg.color }]}>
                      <Feather name="check" size={13} color="#fff" />
                    </View>
                  ) : (
                    <View style={[createStyles.addBadge, { borderColor: colors.border }]}>
                      <Feather name="plus" size={13} color={colors.mutedForeground} />
                    </View>
                  )}
                </Pressable>
              );
            })}

            {filteredPkgs.length === 0 && (
              <Text style={[createStyles.emptyText, { color: colors.mutedForeground }]}>No packages match your search</Text>
            )}

            {/* Summary */}
            {selectedIds.length > 0 && (
              <View style={[createStyles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[createStyles.summaryTitle, { color: colors.foreground }]}>Plan Summary</Text>
                {selectedIds.map((id, idx) => {
                  const pkg = packages.find((p) => p.id === id);
                  return (
                    <View key={`${id}-${idx}`} style={[createStyles.summaryRow, { borderBottomColor: colors.border }]}>
                      <View style={[createStyles.summaryDot, { backgroundColor: pkg?.color ?? "#94a3b8" }]} />
                      <Text style={[createStyles.summaryName, { color: colors.foreground }]}>{pkg?.name ?? "Unknown"}</Text>
                      <Pressable onPress={() => setSelectedIds((prev) => { const copy = [...prev]; copy.splice(idx, 1); return copy; })}>
                        <Feather name="x" size={13} color="#dc2626" />
                      </Pressable>
                    </View>
                  );
                })}
                <View style={createStyles.summaryTotal}>
                  <Text style={[createStyles.summaryTotalLabel, { color: colors.foreground }]}>Total Price Charged</Text>
                  <Text style={[createStyles.summaryTotalValue, { color: "#16a34a" }]}>{formatPrice(totalPrice || "0")}</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AdminPlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "exhausted" | "cancelled">("all");

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [plansRes, pkgsRes] = await Promise.all([
        fetch("/api/service-plans"),
        fetch("/api/service-packages"),
      ]);
      const [plansData, pkgsData] = await Promise.all([
        plansRes.ok ? plansRes.json() : { plans: [] },
        pkgsRes.ok ? pkgsRes.json() : { packages: [] },
      ]);
      setPlans(plansData.plans ?? []);
      setPackages(pkgsData.packages ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDelete = (id: number) => {
    Alert.alert("Delete Plan", "This will permanently remove this service plan and all redemption history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await fetch(`/api/service-plans/${id}`, { method: "DELETE" });
            setPlans((prev) => prev.filter((p) => p.id !== id));
          } catch {
            Alert.alert("Error", "Could not delete plan.");
          }
        },
      },
    ]);
  };

  const handleCancel = (id: number) => {
    Alert.alert("Cancel Plan", "Mark this plan as cancelled? The customer will not be able to redeem remaining services.", [
      { text: "Keep Active", style: "cancel" },
      {
        text: "Cancel Plan", style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`/api/service-plans/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "cancelled" }),
            });
            if (res.ok) {
              const updated = await res.json() as ServicePlan;
              setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
            }
          } catch {
            Alert.alert("Error", "Could not cancel plan.");
          }
        },
      },
    ]);
  };

  const filtered = plans.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.vin.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.customerName ?? "").toLowerCase().includes(q) ||
      p.planNumber.toLowerCase().includes(q)
    );
  });

  const activeCnt = plans.filter((p) => p.status === "active").length;
  const exhaustedCnt = plans.filter((p) => p.status === "exhausted").length;

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Service Plans" showNotifications={false} />
        <View style={styles.center}><ActivityIndicator size="large" color="#16a34a" /></View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Service Plans" showNotifications={false} />

      {/* Toolbar */}
      <View style={[styles.toolbar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search VIN, customer, plan…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        <Pressable style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Feather name="plus" size={15} color="#fff" />
          <Text style={styles.createBtnText}>New Plan</Text>
        </Pressable>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersBar} contentContainerStyle={styles.filtersContent}>
        {(["all", "active", "exhausted", "cancelled"] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === "all" ? `All (${plans.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={[styles.statNum, { color: "#16a34a" }]}>{activeCnt}</Text>
          <Text style={[styles.statLabel, { color: "#16a34a" }]}>Active</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#f1f5f9" }]}>
          <Text style={[styles.statNum, { color: "#64748b" }]}>{exhaustedCnt}</Text>
          <Text style={[styles.statLabel, { color: "#64748b" }]}>Exhausted</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#eff6ff" }]}>
          <Text style={[styles.statNum, { color: "#1d4ed8" }]}>{plans.reduce((s, p) => s + p.remainingSlots, 0)}</Text>
          <Text style={[styles.statLabel, { color: "#1d4ed8" }]}>Services Left</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="credit-card" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search ? "No plans found" : "No service plans yet"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {search ? "Try a different search" : "Tap \"New Plan\" to create a prepaid bundle"}
            </Text>
          </View>
        ) : (
          filtered.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onDelete={handleDelete} onCancel={handleCancel} />
          ))
        )}
      </ScrollView>

      <CreatePlanModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(plan) => setPlans((prev) => [plan, ...prev])}
        packages={packages}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#16a34a",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  createBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  filtersBar: { flexGrow: 0 },
  filtersContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  filterChipActive: { backgroundColor: "#16a34a" },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748b" },
  filterChipTextActive: { color: "#fff" },

  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  statCard: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center", gap: 2 },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  list: { padding: 12, gap: 10 },

  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12, padding: 24 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  // Card
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden", flexDirection: "row" },
  cardAccent: { width: 4 },
  cardMain: { flex: 1, padding: 14, gap: 6 },

  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitleBlock: { flex: 1, gap: 2 },
  planName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  planNumber: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  priceText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Expanded
  expandedBody: { borderTopWidth: 1, padding: 14, gap: 6 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },

  slotRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  slotDot: { width: 8, height: 8, borderRadius: 4 },
  slotName: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  redeemedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  redeemedText: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#64748b" },
  availableBadge: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  availableText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#16a34a" },

  notesText: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 4 },

  cardActions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10, paddingTop: 6 },
  cancelBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  cancelBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#d97706" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: "auto" as const },
  deleteBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#dc2626" },
});

const createStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  saveBtn: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 72,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  scroll: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, marginTop: 8 },

  section: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  field: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
    gap: 2,
  },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  fieldInput: { fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 2 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },

  pkgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  pkgDot: { width: 10, height: 10, borderRadius: 5 },
  pkgInfo: { flex: 1, gap: 2 },
  pkgName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  pkgSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  checkBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  addBadge: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 16 },

  summary: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8, marginTop: 8 },
  summaryTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryName: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  summaryTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 },
  summaryTotalLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summaryTotalValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
});
