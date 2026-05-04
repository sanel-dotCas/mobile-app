import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useAuth } from "@/context/AuthContext";

const BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

type InspectionStatus = "queued" | "in-progress" | "finished";
type CheckResult = "pass" | "fail" | "na";

interface CheckItem {
  id: string;
  label: string;
  result: CheckResult;
  note: string;
}

interface CheckSection {
  section: string;
  icon: "box" | "sun" | "circle" | "layers" | "tool" | "file-text" | "activity" | "droplet";
  items: { id: string; label: string }[];
}

interface Inspection {
  id: number;
  inspectionNumber: string;
  vehicleName: string;
  stockVin: string;
  stockNumber?: string | null;
  vehicleYear?: number | null;
  type: string;
  status: InspectionStatus;
  locationName?: string;
  notes?: string;
  bodyDamage?: string;
  checklist?: string;
  fuelPercentage?: number | null;
  vehicleMileage?: number | null;
  assignedTo?: string | null;
  assignedAt?: string | null;
  createdAt: string;
  completedAt?: string;
}

const STATUS_LABEL: Record<InspectionStatus, string> = {
  queued: "Queued",
  "in-progress": "In Progress",
  finished: "Finished",
};
const STATUS_COLOR: Record<InspectionStatus, string> = {
  queued: "#d97706",
  "in-progress": "#1d4ed8",
  finished: "#16a34a",
};
const STATUS_BG: Record<InspectionStatus, string> = {
  queued: "#fef3c7",
  "in-progress": "#dbeafe",
  finished: "#dcfce7",
};

const TYPE_LABEL: Record<string, string> = {
  "pre-inspection": "Pre-Inspection (PDI)",
  "secondary": "Secondary Check",
  "final-quality": "Final Quality Check",
  "new-arrival": "New Arrival PDI",
  "used-arrival": "Used Arrival PDI",
  "periodic-fluid": "Periodic — Fluid Check",
  "periodic-damage": "Periodic — Damage Scan",
  "start-and-run": "Start & Run Cycle",
};

const ALL_SECTIONS: CheckSection[] = [
  {
    section: "Exterior Body",
    icon: "box",
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
    icon: "sun",
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
    icon: "circle",
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
    icon: "layers",
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
    icon: "tool",
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
    icon: "file-text",
    items: [
      { id: "doc_manual", label: "Owner's manual — present in vehicle" },
      { id: "doc_keys", label: "All keys / key fobs — present" },
      { id: "doc_service", label: "Service book / warranty card — present" },
      { id: "doc_mats", label: "Floor mats and accessories — as specified" },
    ],
  },
];

const FLUID_SECTIONS: CheckSection[] = [
  {
    section: "Fluid Levels",
    icon: "droplet",
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
];

const DAMAGE_SECTIONS: CheckSection[] = [
  ALL_SECTIONS[0], // Exterior Body
  ALL_SECTIONS[1], // Glass & Lights
  ALL_SECTIONS[2], // Wheels & Tyres
];

const START_RUN_SECTIONS: CheckSection[] = [
  {
    section: "Pre-Start Checks",
    icon: "tool",
    items: [
      { id: "sr_oil", label: "Engine oil level — within range" },
      { id: "sr_coolant", label: "Coolant level — within range" },
      { id: "sr_fuel", label: "Sufficient fuel for run" },
      { id: "sr_battery", label: "Battery voltage — 12V+ resting" },
      { id: "sr_leaks", label: "No visible fluid leaks before start" },
    ],
  },
  {
    section: "Start & Run Cycle",
    icon: "activity",
    items: [
      { id: "sr_cranks", label: "Engine cranks and starts normally" },
      { id: "sr_idle", label: "Idle quality — smooth, no misfires" },
      { id: "sr_throttle", label: "Throttle response — progressive and smooth" },
      { id: "sr_warnings", label: "No warning lights while running" },
      { id: "sr_temperature", label: "Temperature reaches normal range" },
      { id: "sr_cooling_fan", label: "Cooling fan — operates correctly" },
      { id: "sr_exhaust", label: "Exhaust — no unusual smoke or smell" },
      { id: "sr_ac_run", label: "A/C — cools with engine running" },
      { id: "sr_alternator", label: "Charging voltage — 13.5–14.5V" },
    ],
  },
  {
    section: "Post-Run Check",
    icon: "tool",
    items: [
      { id: "sr_post_leaks", label: "No fluid leaks after running" },
      { id: "sr_post_temp", label: "Engine cools normally after shutdown" },
      { id: "sr_post_warnings", label: "No warning lights after shutdown" },
    ],
  },
];

function getChecklistSections(type: string): CheckSection[] {
  switch (type) {
    case "periodic-fluid":
      return FLUID_SECTIONS;
    case "periodic-damage":
      return DAMAGE_SECTIONS;
    case "start-and-run":
      return START_RUN_SECTIONS;
    default:
      return ALL_SECTIONS;
  }
}

function buildInitialChecks(sections: CheckSection[]): CheckItem[] {
  return sections.flatMap((s) =>
    s.items.map((item) => ({ id: item.id, label: item.label, result: "na" as CheckResult, note: "" }))
  );
}

const TECHNICIANS = [
  { name: "Mike Rodriguez" },
  { name: "James Wilson" },
  { name: "Carlos Mendez" },
  { name: "Ahmed Hassan" },
  { name: "David Park" },
];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function InspectionDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useAuth();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Checklist form state
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [fuelPct, setFuelPct] = useState("50");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [formInitialised, setFormInitialised] = useState(false);

  const isSupervisor = role === "supervisor";

  const load = () => {
    if (!id) return;
    fetch(`${BASE}/yard/inspections/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data: Inspection) => {
        setInspection(data);
        if (!formInitialised) {
          initForm(data);
          setFormInitialised(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const initForm = (data: Inspection) => {
    const sections = getChecklistSections(data.type);
    let initialChecks = buildInitialChecks(sections);

    if (data.checklist) {
      try {
        const saved: { section: string; items: { label: string; result: CheckResult; note: string }[] }[] = JSON.parse(data.checklist);
        initialChecks = initialChecks.map((c) => {
          for (const sec of saved) {
            const match = sec.items.find((it) => it.label === c.label);
            if (match) return { ...c, result: match.result, note: match.note ?? "" };
          }
          return c;
        });
      } catch { /* ignore parse errors */ }
    }

    setChecks(initialChecks);
    if (data.fuelPercentage != null) setFuelPct(String(data.fuelPercentage));
    if (data.notes) {
      const match = data.notes.match(/Notes: ([\s\S]+)$/);
      if (match) setAdditionalNotes(match[1].trim());
    }
  };

  useEffect(() => { load(); }, [id]);

  const setCheck = (itemId: string, result: CheckResult) => {
    setChecks((prev) => prev.map((c) => c.id === itemId ? { ...c, result } : c));
  };
  const setCheckNote = (itemId: string, note: string) => {
    setChecks((prev) => prev.map((c) => c.id === itemId ? { ...c, note } : c));
  };

  const buildPayload = (status?: InspectionStatus) => {
    if (!inspection) return {};
    const sections = getChecklistSections(inspection.type);
    const checklistSummary = sections.map((s) => ({
      section: s.section,
      items: s.items.map((item) => {
        const c = checks.find((ch) => ch.id === item.id);
        return { label: item.label, result: c?.result ?? "na", note: c?.note ?? "" };
      }),
    }));
    const passCount = checks.filter((c) => c.result === "pass").length;
    const failCount = checks.filter((c) => c.result === "fail").length;
    const naCount = checks.filter((c) => c.result === "na").length;
    const failedLabels = checks.filter((c) => c.result === "fail").map((c) => c.label);
    const bodyDamage = failedLabels.length > 0 ? `Failed items:\n${failedLabels.join("\n")}` : null;
    const notes = [
      `Checklist: ${passCount} passed, ${failCount} failed, ${naCount} N/A out of ${checks.length}`,
      additionalNotes.trim() ? `Notes: ${additionalNotes.trim()}` : null,
    ].filter(Boolean).join("\n");

    return {
      notes,
      bodyDamage,
      fuelPercentage: Number(fuelPct) || null,
      checklist: JSON.stringify(checklistSummary),
      ...(status ? { status } : {}),
    };
  };

  const saveProgress = async () => {
    if (!inspection) return;
    setUpdating(true);
    try {
      const res = await fetch(`${BASE}/yard/inspections/${inspection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setInspection(updated);
      Alert.alert("Saved", "Inspection progress saved.");
    } catch {
      Alert.alert("Error", "Failed to save progress.");
    } finally {
      setUpdating(false);
    }
  };

  const startInspection = async () => {
    if (!inspection) return;
    setUpdating(true);
    try {
      const res = await fetch(`${BASE}/yard/inspections/${inspection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in-progress" }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setInspection(updated);
    } catch {
      Alert.alert("Error", "Failed to start inspection.");
    } finally {
      setUpdating(false);
    }
  };

  const submitInspection = async () => {
    if (!inspection) return;
    const passCount = checks.filter((c) => c.result === "pass").length;
    const answeredCount = checks.filter((c) => c.result !== "na").length;
    if (answeredCount === 0) {
      Alert.alert("Checklist Required", "Please complete at least some checklist items before submitting.");
      return;
    }
    Alert.alert(
      "Submit Inspection",
      `${passCount} passed, ${checks.filter((c) => c.result === "fail").length} failed, ${checks.filter((c) => c.result === "na").length} N/A.\n\nMark this inspection as finished?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setUpdating(true);
            try {
              const res = await fetch(`${BASE}/yard/inspections/${inspection.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload("finished")),
              });
              if (!res.ok) throw new Error();
              const updated = await res.json();
              setInspection(updated);
              Alert.alert("Completed", "Inspection submitted successfully.", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch {
              Alert.alert("Error", "Failed to submit inspection.");
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const assignTech = async (techName: string) => {
    if (!inspection) return;
    setAssigning(true);
    setShowAssignModal(false);
    try {
      const res = await fetch(`${BASE}/yard/inspections/${inspection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: techName }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setInspection(updated);
      Alert.alert("Technician Assigned", `${techName} has been assigned to this inspection.`);
    } catch {
      Alert.alert("Error", "Failed to assign technician.");
    } finally {
      setAssigning(false);
    }
  };

  const unassignTech = async () => {
    if (!inspection) return;
    Alert.alert("Remove Assignment", "Remove the current technician assignment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setAssigning(true);
          try {
            const res = await fetch(`${BASE}/yard/inspections/${inspection.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assignedTo: "" }),
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            setInspection(updated);
          } catch {
            Alert.alert("Error", "Failed to remove assignment.");
          } finally {
            setAssigning(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Inspection Detail" showBack showNotifications={false} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  if (!inspection) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Inspection Detail" showBack showNotifications={false} />
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Inspection not found</Text>
        </View>
      </View>
    );
  }

  const checklistSections = getChecklistSections(inspection.type);
  const passCount = checks.filter((c) => c.result === "pass").length;
  const failCount = checks.filter((c) => c.result === "fail").length;
  const naCount = checks.filter((c) => c.result === "na").length;
  const showForm = inspection.status !== "finished";
  const failedLines = inspection.bodyDamage
    ? inspection.bodyDamage.replace("Failed items:\n", "").split("\n").filter(Boolean)
    : [];

  const FUEL_OPTIONS = ["0", "25", "50", "75", "100"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`Inspection #${inspection.inspectionNumber}`}
        subtitle={inspection.vehicleName}
        showBack
        showNotifications={false}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}>

        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: STATUS_BG[inspection.status] }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[inspection.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLOR[inspection.status] }]}>
            {STATUS_LABEL[inspection.status]}
          </Text>
          <Text style={[styles.typeBadge, { color: STATUS_COLOR[inspection.status] }]}>
            · {TYPE_LABEL[inspection.type] ?? inspection.type}
          </Text>
        </View>

        {/* Vehicle info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle</Text>
          <Text style={[styles.vehicleName, { color: colors.foreground }]}>{inspection.vehicleName}</Text>
          <Text style={[styles.stockVin, { color: colors.mutedForeground }]}>{inspection.stockVin}</Text>
          {inspection.locationName && (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.stockVin, { color: colors.mutedForeground }]}>{inspection.locationName}</Text>
            </View>
          )}
        </View>

        {/* Assignment card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Assigned Technician</Text>

          {inspection.assignedTo ? (
            <View style={styles.assignedRow}>
              <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.techAvatarText}>{initials(inspection.assignedTo)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.techName, { color: colors.foreground }]}>{inspection.assignedTo}</Text>
                {inspection.assignedAt && (
                  <Text style={[styles.stockVin, { color: colors.mutedForeground }]}>
                    Assigned {new Date(inspection.assignedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </Text>
                )}
              </View>
              {isSupervisor && inspection.status !== "finished" && (
                <Pressable
                  onPress={unassignTech}
                  style={[styles.smallBtn, { borderColor: "#ef4444" }]}
                  disabled={assigning}
                >
                  <Text style={{ color: "#ef4444", fontSize: 11, fontFamily: "Inter_500Medium" }}>Remove</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.unassignedRow}>
              <Feather name="user-x" size={16} color={colors.mutedForeground} />
              <Text style={[styles.stockVin, { color: colors.mutedForeground, flex: 1 }]}>
                No technician assigned yet
              </Text>
              {isSupervisor && inspection.status !== "finished" && (
                <Pressable
                  style={[styles.smallBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setShowAssignModal(true)}
                  disabled={assigning}
                >
                  {assigning
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Assign Tech</Text>
                  }
                </Pressable>
              )}
            </View>
          )}

          {isSupervisor && inspection.assignedTo && inspection.status !== "finished" && (
            <Pressable
              style={[styles.reassignBtn, { borderColor: colors.primary }]}
              onPress={() => setShowAssignModal(true)}
              disabled={assigning}
            >
              <Feather name="user-check" size={13} color={colors.primary} />
              <Text style={[styles.reassignText, { color: colors.primary }]}>Reassign Tech</Text>
            </Pressable>
          )}
        </View>

        {/* ── INSPECTION FORM (queued or in-progress) ─── */}
        {showForm && (
          <>
            {/* Start inspection prompt if still queued */}
            {inspection.status === "queued" && (
              <View style={[styles.card, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                <View style={styles.sectionHeader}>
                  <Feather name="info" size={14} color="#1d4ed8" />
                  <Text style={[styles.sectionTitle, { color: "#1d4ed8", marginBottom: 0 }]}>Ready to start?</Text>
                </View>
                <Text style={[styles.noteLine, { color: "#1e40af" }]}>
                  Fill in the checklist below, then tap "Submit Inspection" to complete it — or tap "Start Inspection" to mark it as in-progress first.
                </Text>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                  onPress={startInspection}
                  disabled={updating}
                >
                  {updating ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Feather name="play" size={15} color="#fff" />
                      <Text style={styles.actionBtnText}>Start Inspection</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* Checklist progress summary */}
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
                  <Text style={[styles.progressNum, { color: colors.primary }]}>{checks.length}</Text>
                  <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>Total</Text>
                </View>
              </View>
            </View>

            {/* Checklist sections */}
            {checklistSections.map((section) => (
              <View key={section.section} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Feather name={section.icon} size={15} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                    {section.section}
                  </Text>
                </View>

                {section.items.map((item) => {
                  const check = checks.find((c) => c.id === item.id) ?? { id: item.id, label: item.label, result: "na" as CheckResult, note: "" };
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

            {/* Fuel Level */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Fuel Level</Text>
              <View style={styles.fuelBtnRow}>
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
              <View style={[styles.fuelBar, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.fuelFill,
                    {
                      width: `${Number(fuelPct)}%`,
                      backgroundColor: Number(fuelPct) < 25 ? "#ef4444" : Number(fuelPct) < 50 ? "#d97706" : "#16a34a",
                    },
                  ]}
                />
              </View>
            </View>

            {/* Additional Notes */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Additional Notes</Text>
              <TextInput
                style={[styles.notesInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
                placeholder="Any other observations about the vehicle or conditions…"
                placeholderTextColor={colors.mutedForeground}
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.saveBtn, { borderColor: colors.primary, flex: 1 }]}
                onPress={saveProgress}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color={colors.primary} size="small" /> : (
                  <>
                    <Feather name="save" size={15} color={colors.primary} />
                    <Text style={[styles.saveBtnText, { color: colors.primary }]}>Save Progress</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.submitBtn, { backgroundColor: "#16a34a", flex: 1 }]}
                onPress={submitInspection}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Feather name="check-circle" size={15} color="#fff" />
                    <Text style={styles.submitBtnText}>Submit Inspection</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}

        {/* ── FINISHED STATE ─── */}
        {inspection.status === "finished" && (
          <>
            {inspection.notes && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Checklist Summary</Text>
                {inspection.notes.split("\n").map((line, i) => (
                  <Text key={i} style={[styles.noteLine, { color: colors.foreground }]}>{line}</Text>
                ))}
              </View>
            )}

            {failedLines.length > 0 && (
              <View style={[styles.card, { backgroundColor: "#fff1f2", borderColor: "#fca5a5" }]}>
                <View style={styles.sectionHeader}>
                  <Feather name="alert-triangle" size={14} color="#ef4444" />
                  <Text style={[styles.sectionTitle, { color: "#ef4444", marginBottom: 0 }]}>
                    Failed Items ({failedLines.length})
                  </Text>
                </View>
                {failedLines.map((line, i) => (
                  <View key={i} style={styles.failLine}>
                    <Feather name="x-circle" size={13} color="#ef4444" />
                    <Text style={[styles.failLineText, { color: "#991b1b" }]}>{line}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={[styles.card, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
              <View style={styles.sectionHeader}>
                <Feather name="check-circle" size={14} color="#16a34a" />
                <Text style={[styles.sectionTitle, { color: "#16a34a", marginBottom: 0 }]}>
                  Inspection Complete
                </Text>
              </View>
              <Text style={[styles.noteLine, { color: "#166534" }]}>
                Completed on{" "}
                {inspection.completedAt
                  ? new Date(inspection.completedAt).toLocaleDateString("en-GB", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                    })
                  : "—"}
                {failedLines.length === 0 ? " with no failed items." : ` with ${failedLines.length} failed item${failedLines.length !== 1 ? "s" : ""} noted.`}
              </Text>
            </View>

            {inspection.fuelPercentage != null && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Fuel Level at Completion</Text>
                <View style={styles.fuelRow}>
                  <View style={[styles.fuelBar, { backgroundColor: colors.muted, flex: 1 }]}>
                    <View
                      style={[
                        styles.fuelFill,
                        {
                          width: `${inspection.fuelPercentage}%`,
                          backgroundColor: inspection.fuelPercentage < 25 ? "#ef4444" : inspection.fuelPercentage < 50 ? "#d97706" : "#16a34a",
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.fuelPct, { color: colors.foreground }]}>{inspection.fuelPercentage}%</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Timeline */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Timeline</Text>
          <View style={styles.dateRow}>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Created</Text>
            <Text style={[styles.dateValue, { color: colors.foreground }]}>
              {new Date(inspection.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
          {inspection.assignedAt && (
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Assigned</Text>
              <Text style={[styles.dateValue, { color: colors.foreground }]}>
                {new Date(inspection.assignedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          )}
          {inspection.completedAt && (
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Completed</Text>
              <Text style={[styles.dateValue, { color: colors.foreground }]}>
                {new Date(inspection.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Assign Tech Modal */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAssignModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Assign Technician</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              The assigned tech will see this inspection in their yard tab
            </Text>
            {TECHNICIANS.map((tech) => (
              <Pressable
                key={tech.name}
                style={[
                  styles.techRow,
                  { borderColor: colors.border },
                  inspection.assignedTo === tech.name && { backgroundColor: "#eff6ff", borderColor: "#1d4ed8" },
                ]}
                onPress={() => assignTech(tech.name)}
              >
                <View style={[styles.techAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.techAvatarText}>{initials(tech.name)}</Text>
                </View>
                <Text style={[styles.techName, { color: colors.foreground, flex: 1 }]}>{tech.name}</Text>
                {inspection.assignedTo === tech.name && (
                  <Feather name="check" size={16} color="#1d4ed8" />
                )}
              </Pressable>
            ))}
            <Pressable
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowAssignModal(false)}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  content: { padding: 16, gap: 12 },
  statusBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  typeBadge: { fontSize: 13, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 10 },
  vehicleName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  stockVin: { fontSize: 12, fontFamily: "Inter_400Regular" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  assignedRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  unassignedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  techAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  techAvatarText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  techName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  reassignBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, alignSelf: "flex-start" },
  reassignText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  progressCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  progressRow: { flexDirection: "row", justifyContent: "space-around" },
  progressItem: { alignItems: "center", gap: 2 },
  progressNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  progressLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  checkItem: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  checkLabel: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  checkBtns: { flexDirection: "row", gap: 8 },
  checkBtn: { flex: 1, borderWidth: 1, borderRadius: 6, paddingVertical: 6, alignItems: "center" },
  checkBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  checkNote: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 60, lineHeight: 19 },

  fuelBtnRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  fuelBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  fuelBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fuelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fuelBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  fuelFill: { height: "100%", borderRadius: 4 },
  fuelPct: { fontSize: 14, fontFamily: "Inter_700Bold", minWidth: 40, textAlign: "right" },

  notesInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 80, lineHeight: 20 },

  actionRow: { flexDirection: "row", gap: 10 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10 },
  submitBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  noteLine: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  failLine: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingVertical: 4 },
  failLineText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 },

  dateRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  dateLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  dateValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, gap: 10 },
  modalHandle: { width: 36, height: 4, backgroundColor: "#e2e8f0", borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 6 },
  techRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  cancelBtn: { padding: 14, borderRadius: 10, borderWidth: 1, alignItems: "center", marginTop: 4 },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
