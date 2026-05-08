import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

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
  expiryDate: string | null;
  maxMileage: number | null;
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

        {/* Expiry + mileage pills */}
        {(plan.expiryDate || plan.maxMileage) ? (
          <View style={styles.pillRow}>
            {plan.expiryDate ? (() => {
              const expired = new Date(plan.expiryDate) < new Date();
              return (
                <View style={[styles.pill, { backgroundColor: expired ? "#fef2f2" : "#eff6ff" }]}>
                  <Feather name="calendar" size={10} color={expired ? "#dc2626" : "#1d4ed8"} />
                  <Text style={[styles.pillText, { color: expired ? "#dc2626" : "#1d4ed8" }]}>
                    {expired ? "Expired " : "Expires "}{new Date(plan.expiryDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                  </Text>
                </View>
              );
            })() : null}
            {plan.maxMileage ? (
              <View style={[styles.pill, { backgroundColor: "#fefce8" }]}>
                <Feather name="activity" size={10} color="#b45309" />
                <Text style={[styles.pillText, { color: "#b45309" }]}>Max {plan.maxMileage.toLocaleString()} km</Text>
              </View>
            ) : null}
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

// ── DMS job lookup result type ────────────────────────────────────────────────

interface DmsJobResult {
  id: string;
  licensePlate: string;
  vehicleLabel: string;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  customerName: string;
  customerNotes: string;
}

// ── Customer search field ─────────────────────────────────────────────────────

function CustomerSearchField({
  value,
  onSelect,
  colors,
}: {
  value: string;
  onSelect: (name: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { mobileSessionToken } = useAuth();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<DmsJobResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const search = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (mobileSessionToken) headers["Authorization"] = `Bearer ${mobileSessionToken}`;
        const res = await fetch(`${BASE}/jobs/dms-lookup?q=${encodeURIComponent(text)}`, { headers });
        if (res.ok) {
          const data = await res.json() as { results: DmsJobResult[] };
          const seen = new Set<string>();
          const unique = data.results.filter((r) => {
            if (!r.customerName || seen.has(r.customerName)) return false;
            seen.add(r.customerName);
            return true;
          });
          setResults(unique);
          setShowDropdown(unique.length > 0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const pick = (name: string) => {
    setQuery(name);
    setShowDropdown(false);
    onSelect(name);
  };

  return (
    <View>
      <View style={[createStyles.field, { borderBottomWidth: 0 }]}>
        <Text style={[createStyles.fieldLabel, { color: colors.mutedForeground }]}>Customer Name</Text>
        <View style={createStyles.searchFieldRow}>
          <TextInput
            style={[createStyles.fieldInput, { color: colors.foreground, flex: 1 }]}
            value={query}
            onChangeText={search}
            placeholder="Search DMS or type name…"
            placeholderTextColor={colors.mutedForeground}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            onFocus={() => query.length >= 1 && results.length > 0 && setShowDropdown(true)}
          />
          {loading && <ActivityIndicator size="small" color="#16a34a" style={{ marginRight: 4 }} />}
          {!loading && query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setResults([]); setShowDropdown(false); onSelect(""); }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
          {!loading && query.length === 0 && (
            <Feather name="search" size={14} color={colors.mutedForeground} />
          )}
        </View>
      </View>
      {showDropdown && (
        <View style={[createStyles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {results.map((r) => (
            <Pressable
              key={r.id}
              style={[createStyles.dropdownRow, { borderBottomColor: colors.border }]}
              onPress={() => pick(r.customerName)}
            >
              <Feather name="user" size={13} color="#16a34a" />
              <View style={{ flex: 1 }}>
                <Text style={[createStyles.dropdownPrimary, { color: colors.foreground }]}>{r.customerName}</Text>
                {r.vehicleLabel ? (
                  <Text style={[createStyles.dropdownSub, { color: colors.mutedForeground }]}>{r.vehicleLabel} · {r.licensePlate}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ── VIN field with decode ─────────────────────────────────────────────────────

function VinField({
  value,
  onChangeVin,
  onVehicleDecoded,
  colors,
}: {
  value: string;
  onChangeVin: (v: string) => void;
  onVehicleDecoded: (label: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { mobileSessionToken } = useAuth();
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<string | null>(null);
  const [dmsSuggestions, setDmsSuggestions] = useState<DmsJobResult[]>([]);
  const [showDms, setShowDms] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    onChangeVin(clean);
    setDecodeError(null);
    setDecoded(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (clean.length >= 3) {
      debounceRef.current = setTimeout(async () => {
        try {
          const headers: Record<string, string> = {};
          if (mobileSessionToken) headers["Authorization"] = `Bearer ${mobileSessionToken}`;
          const res = await fetch(`${BASE}/jobs/dms-lookup?q=${encodeURIComponent(clean)}`, { headers });
          if (res.ok) {
            const data = await res.json() as { results: DmsJobResult[] };
            const withPlate = data.results.filter((r) =>
              r.licensePlate.toUpperCase().replace(/\s/g, "").includes(clean.replace(/\s/g, ""))
            );
            setDmsSuggestions(withPlate.slice(0, 5));
            setShowDms(withPlate.length > 0);
          }
        } catch { /* ignore */ }
      }, 400);
    } else {
      setDmsSuggestions([]);
      setShowDms(false);
    }
  };

  const decode = async () => {
    const clean = value.trim();
    if (clean.length !== 17) {
      setDecodeError("VIN must be exactly 17 characters to decode");
      return;
    }
    setDecoding(true);
    setDecodeError(null);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${clean}?format=json`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) throw new Error("Network error");
      const data = await res.json() as { Results?: { Variable: string; Value: string | null }[] };
      const results = data.Results ?? [];
      const get = (v: string) => results.find((r) => r.Variable === v)?.Value ?? "";
      const make = get("Make");
      const model = get("Model");
      const year = get("Model Year");
      const trim = get("Trim") || get("Series");
      if (!make || make === "0") {
        setDecodeError("VIN not found — check the number and try again");
        return;
      }
      const label = [year, make, model, trim].filter(Boolean).join(" ");
      setDecoded(label);
      onVehicleDecoded(label);
    } catch {
      setDecodeError("Could not reach VIN database — check your connection");
    } finally {
      setDecoding(false);
    }
  };

  const pickDms = (r: DmsJobResult) => {
    const plate = r.licensePlate.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    onChangeVin(plate);
    if (r.vehicleLabel) {
      setDecoded(r.vehicleLabel);
      onVehicleDecoded(r.vehicleLabel);
    }
    setShowDms(false);
  };

  return (
    <View>
      <View style={createStyles.field}>
        <Text style={[createStyles.fieldLabel, { color: colors.mutedForeground }]}>VIN / Registration *</Text>
        <View style={createStyles.searchFieldRow}>
          <TextInput
            style={[createStyles.fieldInput, { color: colors.foreground, flex: 1, letterSpacing: 1 }]}
            value={value}
            onChangeText={handleChange}
            placeholder="Enter or scan VIN…"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            maxLength={17}
            onBlur={() => setTimeout(() => setShowDms(false), 200)}
          />
          <Pressable
            onPress={decode}
            disabled={decoding || value.length < 5}
            style={[
              createStyles.decodeBtn,
              (decoding || value.length < 5) && { opacity: 0.4 },
            ]}
          >
            {decoding
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={createStyles.decodeBtnText}>Decode</Text>}
          </Pressable>
        </View>
        {decodeError ? (
          <Text style={createStyles.decodeError}>{decodeError}</Text>
        ) : decoded ? (
          <View style={createStyles.decodedBadge}>
            <Feather name="check-circle" size={12} color="#16a34a" />
            <Text style={createStyles.decodedText}>{decoded}</Text>
          </View>
        ) : null}
      </View>
      {showDms && (
        <View style={[createStyles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[createStyles.dropdownHeader, { color: colors.mutedForeground }]}>DMS MATCHES</Text>
          {dmsSuggestions.map((r) => (
            <Pressable
              key={r.id}
              style={[createStyles.dropdownRow, { borderBottomColor: colors.border }]}
              onPress={() => pickDms(r)}
            >
              <Feather name="truck" size={13} color="#1d4ed8" />
              <View style={{ flex: 1 }}>
                <Text style={[createStyles.dropdownPrimary, { color: colors.foreground }]}>{r.licensePlate}</Text>
                {r.vehicleLabel ? (
                  <Text style={[createStyles.dropdownSub, { color: colors.mutedForeground }]}>
                    {r.vehicleLabel}{r.customerName ? ` · ${r.customerName}` : ""}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
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
  const { userCode, locationId, mobileSessionToken } = useAuth();

  const [name, setName] = useState("");
  const [vin, setVin] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [maxMileage, setMaxMileage] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [pkgSearch, setPkgSearch] = useState("");

  const reset = () => {
    setName(""); setVin(""); setVehicleLabel(""); setCustomerName("");
    setTotalPrice(""); setNotes(""); setExpiryDate(""); setMaxMileage("");
    setSelectedIds([]); setPkgSearch("");
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
      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      if (mobileSessionToken) hdrs["Authorization"] = `Bearer ${mobileSessionToken}`;
      const res = await fetch(`${BASE}/service-plans`, {
        method: "POST",
        headers: hdrs,
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
          expiryDate: expiryDate.trim() || null,
          maxMileage: maxMileage.trim() ? parseInt(maxMileage.trim(), 10) : null,
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
              {/* Plan name */}
              <View style={createStyles.field}>
                <Text style={[createStyles.fieldLabel, { color: colors.mutedForeground }]}>Plan Name *</Text>
                <TextInput
                  style={[createStyles.fieldInput, { color: colors.foreground }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. RAM 3-Year Service Plan"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Customer search — from DMS */}
              <CustomerSearchField
                value={customerName}
                onSelect={setCustomerName}
                colors={colors}
              />

              {/* VIN with decoder */}
              <VinField
                value={vin}
                onChangeVin={setVin}
                onVehicleDecoded={setVehicleLabel}
                colors={colors}
              />

              {/* Vehicle label — auto-filled by VIN decoder, editable */}
              <View style={createStyles.field}>
                <Text style={[createStyles.fieldLabel, { color: colors.mutedForeground }]}>Vehicle (make/model/year)</Text>
                <TextInput
                  style={[createStyles.fieldInput, { color: colors.foreground }]}
                  value={vehicleLabel}
                  onChangeText={setVehicleLabel}
                  placeholder="Auto-filled from VIN decode or type manually"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Price */}
              <View style={createStyles.field}>
                <Text style={[createStyles.fieldLabel, { color: colors.mutedForeground }]}>Total Price Paid (R)</Text>
                <TextInput
                  style={[createStyles.fieldInput, { color: colors.foreground }]}
                  value={totalPrice}
                  onChangeText={setTotalPrice}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Expiry */}
              <View style={createStyles.field}>
                <Text style={[createStyles.fieldLabel, { color: colors.mutedForeground }]}>Expiry Date (optional)</Text>
                <TextInput
                  style={[createStyles.fieldInput, { color: colors.foreground }]}
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              {/* Max Mileage */}
              <View style={createStyles.field}>
                <Text style={[createStyles.fieldLabel, { color: colors.mutedForeground }]}>Max Mileage (km, optional)</Text>
                <TextInput
                  style={[createStyles.fieldInput, { color: colors.foreground }]}
                  value={maxMileage}
                  onChangeText={setMaxMileage}
                  placeholder="e.g. 150000"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </View>

              {/* Notes */}
              <View style={[createStyles.field, { borderBottomWidth: 0 }]}>
                <Text style={[createStyles.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
                <TextInput
                  style={[createStyles.fieldInput, { color: colors.foreground }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any notes about this plan…"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
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
  const { mobileSessionToken } = useAuth();
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const authHeaders = useCallback((): Record<string, string> => {
    return mobileSessionToken ? { Authorization: `Bearer ${mobileSessionToken}` } : {};
  }, [mobileSessionToken]);

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
      const hdrs = authHeaders();
      const [plansRes, pkgsRes] = await Promise.all([
        fetch(`${BASE}/service-plans`, { headers: hdrs }),
        fetch(`${BASE}/service-packages`, { headers: hdrs }),
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
  }, [authHeaders]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDelete = (id: number) => {
    Alert.alert("Delete Plan", "This will permanently remove this service plan and all redemption history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${BASE}/service-plans/${id}`, { method: "DELETE", headers: authHeaders() });
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
            const cancelHdrs = authHeaders();
            cancelHdrs["Content-Type"] = "application/json";
            const res = await fetch(`${BASE}/service-plans/${id}`, {
              method: "PATCH",
              headers: cancelHdrs,
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

  pillRow:  { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 },
  pill:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

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

  searchFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },

  dropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 2,
    marginHorizontal: 4,
    overflow: "hidden",
    zIndex: 10,
  },
  dropdownHeader: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownPrimary: { fontSize: 13, fontFamily: "Inter_500Medium" },
  dropdownSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  decodeBtn: {
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
    minWidth: 60,
    alignItems: "center",
  },
  decodeBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  decodeError: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#dc2626", marginTop: 4 },
  decodedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  decodedText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#16a34a" },
});
