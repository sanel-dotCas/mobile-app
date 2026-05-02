import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

interface YardVehicle {
  id: number;
  stockNumber: string;
  make: string;
  model: string;
  year: number;
  status: string;
}

type CheckResult = "pass" | "fail" | "na";

interface CheckItem {
  id: string;
  label: string;
  result: CheckResult;
  note: string;
}

const CHECKLIST_SECTIONS = [
  {
    section: "Exterior Body",
    icon: "box" as const,
    items: [
      { id: "ext_hood", label: "Hood / bonnet — no dents or scratches" },
      { id: "ext_roof", label: "Roof panel — no damage" },
      { id: "ext_trunk", label: "Boot / trunk lid — aligned and latches" },
      { id: "ext_doors_fl", label: "Front Left door — paint, alignment, seals" },
      { id: "ext_doors_fr", label: "Front Right door — paint, alignment, seals" },
      { id: "ext_doors_rl", label: "Rear Left door — paint, alignment, seals" },
      { id: "ext_doors_rr", label: "Rear Right door — paint, alignment, seals" },
      { id: "ext_bumper_f", label: "Front bumper — no cracks or scratches" },
      { id: "ext_bumper_r", label: "Rear bumper — no cracks or scratches" },
      { id: "ext_fenders", label: "Fenders / quarter panels — no damage" },
      { id: "ext_sills", label: "Side sills — clean, no damage" },
    ],
  },
  {
    section: "Glass & Lights",
    icon: "sun" as const,
    items: [
      { id: "glass_windscreen", label: "Windscreen — no chips or cracks" },
      { id: "glass_rear", label: "Rear window — no chips or cracks" },
      { id: "glass_windows", label: "Side windows — all intact" },
      { id: "glass_mirrors", label: "Wing mirrors — glass and motor OK" },
      { id: "lights_headlamps", label: "Headlamps (L & R) — function and alignment" },
      { id: "lights_taillamps", label: "Taillamps (L & R) — function" },
      { id: "lights_indicators", label: "Indicators — front, rear and side" },
      { id: "lights_hazards", label: "Hazard warning lights" },
      { id: "lights_reversing", label: "Reversing lights" },
      { id: "lights_interior", label: "Interior lights — all working" },
    ],
  },
  {
    section: "Wheels & Tyres",
    icon: "circle" as const,
    items: [
      { id: "tyre_fl", label: "Front Left tyre — condition & pressure" },
      { id: "tyre_fr", label: "Front Right tyre — condition & pressure" },
      { id: "tyre_rl", label: "Rear Left tyre — condition & pressure" },
      { id: "tyre_rr", label: "Rear Right tyre — condition & pressure" },
      { id: "tyre_spare", label: "Spare tyre / repair kit — present" },
      { id: "wheels_alloy", label: "Alloy wheels — no kerbing or cracks" },
      { id: "wheels_caps", label: "Wheel caps / centre caps — present" },
    ],
  },
  {
    section: "Interior",
    icon: "layers" as const,
    items: [
      { id: "int_seats", label: "Seats — no tears, stains or damage" },
      { id: "int_carpets", label: "Carpets & floor mats — present and clean" },
      { id: "int_dash", label: "Dashboard — no cracks or warning lights" },
      { id: "int_steering", label: "Steering wheel — condition OK" },
      { id: "int_ac", label: "Air conditioning — cools correctly" },
      { id: "int_infotainment", label: "Infotainment / screen — powers on" },
      { id: "int_windows", label: "Electric windows — all 4 operate" },
      { id: "int_sunroof", label: "Sunroof / moonroof — operates (if fitted)" },
      { id: "int_seatbelts", label: "Seatbelts — all present and latch" },
    ],
  },
  {
    section: "Under Bonnet",
    icon: "tool" as const,
    items: [
      { id: "eng_oil", label: "Engine oil level — within range" },
      { id: "eng_coolant", label: "Coolant level — within range" },
      { id: "eng_brakefluid", label: "Brake fluid — within range" },
      { id: "eng_washer", label: "Windscreen washer fluid — topped up" },
      { id: "eng_battery", label: "Battery terminals — clean, tight" },
      { id: "eng_belts", label: "Drive belts — no visible cracking" },
      { id: "eng_leaks", label: "No visible fluid leaks" },
    ],
  },
  {
    section: "Documentation & Keys",
    icon: "file-text" as const,
    items: [
      { id: "doc_manual", label: "Owner's manual — present in vehicle" },
      { id: "doc_keys", label: "All keys / key fobs — present" },
      { id: "doc_service", label: "Service book / warranty card — present" },
      { id: "doc_mats", label: "Floor mats and accessories — as specified" },
    ],
  },
];

export default function NewInspectionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { vehicleId: preselectedId } = useLocalSearchParams<{ vehicleId?: string }>();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [vehicles, setVehicles] = useState<YardVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<string>(preselectedId ?? "");
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

  const [inspType, setInspType] = useState<"pre-inspection" | "secondary" | "final-quality">("pre-inspection");
  const [fuelPct, setFuelPct] = useState("50");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const initialChecks = (): CheckItem[] =>
    CHECKLIST_SECTIONS.flatMap((s) =>
      s.items.map((item) => ({ id: item.id, label: item.label, result: "na" as CheckResult, note: "" }))
    );
  const [checks, setChecks] = useState<CheckItem[]>(initialChecks());

  useEffect(() => {
    fetch(`${BASE}/yard/vehicles?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const eligible = (data.vehicles ?? []).filter(
          (v: YardVehicle) => v.status === "available" || v.status === "in_transit" || v.status === "pdi_pending"
        );
        setVehicles(eligible);
        setLoadingVehicles(false);
      })
      .catch(() => setLoadingVehicles(false));
  }, []);

  const setCheck = (id: string, result: CheckResult) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, result } : c)));
  };

  const setCheckNote = (id: string, note: string) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, note } : c)));
  };

  const passCount = checks.filter((c) => c.result === "pass").length;
  const failCount = checks.filter((c) => c.result === "fail").length;
  const naCount = checks.filter((c) => c.result === "na").length;
  const totalChecks = checks.length;

  const selectedVehicleObj = vehicles.find((v) => String(v.id) === selectedVehicle);

  const handleSubmit = async () => {
    if (!selectedVehicle) {
      Alert.alert("Required", "Please select a vehicle before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const checklistSummary = CHECKLIST_SECTIONS.map((s) => ({
        section: s.section,
        items: s.items.map((item) => {
          const check = checks.find((c) => c.id === item.id);
          return { label: item.label, result: check?.result ?? "na", note: check?.note ?? "" };
        }),
      }));

      const failedItems = checks.filter((c) => c.result === "fail").map((c) => c.label);
      const bodyDamage = failedItems.length > 0 ? `Failed items:\n${failedItems.join("\n")}` : null;
      const fullNotes = [
        `Checklist: ${passCount} passed, ${failCount} failed, ${naCount} N/A out of ${totalChecks}`,
        notes.trim() ? `Notes: ${notes.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch(`${BASE}/yard/inspections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: Number(selectedVehicle),
          type: inspType,
          fuelPercentage: Number(fuelPct) || 50,
          bodyDamage,
          notes: fullNotes,
          checklist: JSON.stringify(checklistSummary),
        }),
      });
      if (!res.ok) throw new Error("Submit failed");
      Alert.alert("Success", "PDI inspection created successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to submit inspection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const TYPE_OPTIONS: Array<{ label: string; value: typeof inspType }> = [
    { label: "Pre-Inspection (PDI)", value: "pre-inspection" },
    { label: "Secondary Check", value: "secondary" },
    { label: "Final Quality", value: "final-quality" },
  ];

  const FUEL_OPTIONS = ["0", "25", "50", "75", "100"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="New PDI Inspection" showBack showNotifications={false} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}>
        {/* Vehicle selector */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            <Feather name="truck" size={14} /> Vehicle
          </Text>
          <Pressable
            style={[styles.picker, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowVehiclePicker(!showVehiclePicker)}
          >
            <Text style={[styles.pickerText, { color: selectedVehicleObj ? colors.foreground : colors.mutedForeground }]}>
              {selectedVehicleObj
                ? `${selectedVehicleObj.year} ${selectedVehicleObj.make} ${selectedVehicleObj.model} — Stock #${selectedVehicleObj.stockNumber}`
                : "Select a vehicle…"}
            </Text>
            <Feather name={showVehiclePicker ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          </Pressable>

          {showVehiclePicker && (
            <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {loadingVehicles ? (
                <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
              ) : vehicles.length === 0 ? (
                <Text style={[styles.emptyPicker, { color: colors.mutedForeground }]}>No eligible vehicles</Text>
              ) : (
                vehicles.map((v) => (
                  <Pressable
                    key={v.id}
                    style={[
                      styles.dropdownItem,
                      { borderBottomColor: colors.border },
                      selectedVehicle === String(v.id) && { backgroundColor: colors.accent },
                    ]}
                    onPress={() => {
                      setSelectedVehicle(String(v.id));
                      setShowVehiclePicker(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: colors.foreground }]}>
                      {v.year} {v.make} {v.model}
                    </Text>
                    <Text style={[styles.dropdownItemSub, { color: colors.mutedForeground }]}>
                      Stock #{v.stockNumber}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>

        {/* Inspection type */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Inspection Type</Text>
          <View style={styles.typeRow}>
            {TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: inspType === opt.value ? colors.primary : colors.background,
                    borderColor: inspType === opt.value ? colors.primary : colors.border,
                    flex: 1,
                  },
                ]}
                onPress={() => setInspType(opt.value)}
              >
                <Text style={[styles.typeChipText, { color: inspType === opt.value ? "#fff" : colors.foreground }]} numberOfLines={2}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Fuel level */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Fuel Level</Text>
          <View style={styles.fuelRow}>
            {FUEL_OPTIONS.map((pct) => (
              <Pressable
                key={pct}
                style={[
                  styles.fuelBtn,
                  {
                    backgroundColor: fuelPct === pct ? colors.primary : colors.background,
                    borderColor: fuelPct === pct ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFuelPct(pct)}
              >
                <Text style={[styles.fuelBtnText, { color: fuelPct === pct ? "#fff" : colors.foreground }]}>
                  {pct}%
                </Text>
              </Pressable>
            ))}
          </View>
          {/* Fuel bar */}
          <View style={[styles.fuelBar, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.fuelFill,
                {
                  width: `${Number(fuelPct)}%`,
                  backgroundColor:
                    Number(fuelPct) < 25 ? "#ef4444" : Number(fuelPct) < 50 ? "#d97706" : "#16a34a",
                },
              ]}
            />
          </View>
        </View>

        {/* Progress summary */}
        <View style={[styles.progressCard, { backgroundColor: colors.accent, borderColor: colors.primary }]}>
          <View style={styles.progressRow}>
            <View style={styles.progressItem}>
              <Text style={[styles.progressNum, { color: "#16a34a" }]}>{passCount}</Text>
              <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>Pass</Text>
            </View>
            <View style={styles.progressItem}>
              <Text style={[styles.progressNum, { color: "#ef4444" }]}>{failCount}</Text>
              <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>Fail</Text>
            </View>
            <View style={styles.progressItem}>
              <Text style={[styles.progressNum, { color: colors.mutedForeground }]}>{naCount}</Text>
              <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>N/A</Text>
            </View>
            <View style={styles.progressItem}>
              <Text style={[styles.progressNum, { color: colors.primary }]}>{totalChecks}</Text>
              <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>Total</Text>
            </View>
          </View>
        </View>

        {/* Checklist sections */}
        {CHECKLIST_SECTIONS.map((section) => (
          <View key={section.section} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name={section.icon} size={15} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                {section.section}
              </Text>
            </View>

            {section.items.map((item) => {
              const check = checks.find((c) => c.id === item.id)!;
              return (
                <View key={item.id} style={[styles.checkItem, { borderTopColor: colors.border }]}>
                  <Text style={[styles.checkLabel, { color: colors.foreground }]}>{item.label}</Text>
                  <View style={styles.checkBtns}>
                    {(["pass", "fail", "na"] as CheckResult[]).map((r) => (
                      <Pressable
                        key={r}
                        style={[
                          styles.checkBtn,
                          {
                            backgroundColor:
                              check.result === r
                                ? r === "pass" ? "#dcfce7" : r === "fail" ? "#fee2e2" : colors.muted
                                : colors.background,
                            borderColor:
                              check.result === r
                                ? r === "pass" ? "#16a34a" : r === "fail" ? "#ef4444" : colors.mutedForeground
                                : colors.border,
                          },
                        ]}
                        onPress={() => setCheck(item.id, r)}
                      >
                        <Text
                          style={[
                            styles.checkBtnText,
                            {
                              color:
                                check.result === r
                                  ? r === "pass" ? "#16a34a" : r === "fail" ? "#ef4444" : colors.mutedForeground
                                  : colors.mutedForeground,
                            },
                          ]}
                        >
                          {r === "pass" ? "Pass" : r === "fail" ? "Fail" : "N/A"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {check.result === "fail" && (
                    <TextInput
                      style={[styles.checkNote, { borderColor: "#fca5a5", backgroundColor: "#fff1f2", color: colors.foreground }]}
                      placeholder="Describe the issue…"
                      placeholderTextColor="#f87171"
                      value={check.note}
                      onChangeText={(t) => setCheckNote(item.id, t)}
                      multiline
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* General notes */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Additional Notes</Text>
          <TextInput
            style={[styles.notesInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
            placeholder="Any other observations about the vehicle or storage conditions…"
            placeholderTextColor={colors.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <Pressable
          style={[
            styles.submitBtn,
            { backgroundColor: submitting ? colors.mutedForeground : colors.primary },
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Submit Inspection</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  pickerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    marginRight: 8,
  },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 6,
    overflow: "hidden",
    maxHeight: 240,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  dropdownItemSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  emptyPicker: {
    padding: 16,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  typeChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  fuelRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  fuelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  fuelBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  fuelBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fuelFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  progressItem: {
    alignItems: "center",
    gap: 2,
  },
  progressNum: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  checkItem: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  checkLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  checkBtns: {
    flexDirection: "row",
    gap: 8,
  },
  checkBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
  },
  checkBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  checkNote: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    minHeight: 56,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 90,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 4,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
