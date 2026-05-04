import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "vehicles" | "inspections" | "jobs";

interface VehicleRow {
  id: number; stockNumber: string; vin: string; make: string; model: string;
  year: number; status: string; locationName: string | null; locationId: number | null;
}
interface VehicleDetail extends VehicleRow {
  color: string | null; mileage: number | null; condition: string | null;
  spotCode: string | null; zoneName: string | null; price: number | null;
  arrivedAt: string | null; inspectionIntervalDays: number;
}
interface InspectionRow {
  id: number; inspectionNumber: string; vehicleName: string; status: string;
  assignedTo: string | null; createdAt: string; type: string; locationName: string | null;
  vehicleId: number;
}
interface InspectionDetail extends InspectionRow {
  notes: string | null; bodyDamage: string | null; fuelPercentage: number | null;
  completedAt: string | null; assignedAt: string | null;
}
interface JobRow {
  id: string; estimateNumber: string; vehicleName: string; status: string;
  assignedTechnicianId: string | null; progress: number; createdAt: string;
  serviceAdvisor: string | null; vehicleMake: string; vehicleModel: string; vehicleYear: number;
}
interface JobDetail extends JobRow {
  tasks: Array<{ id: string; title: string; status: string; assignedTo: string | null }>;
  notes: Array<{ id: string; text: string; author: string; createdAt: string }>;
  workedHours: number; appointmentDate: string | null; licensePlate: string | null;
}
interface Location { id: number; name: string; type: string; city: string | null; }
interface Tech { id: string; name: string; userCode: string; status: string | null; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VEHICLE_STATUSES = ["available", "in_transit", "pdi_pending", "sold"];
const INSPECTION_STATUSES = ["queued", "in-progress", "finished"];
const JOB_STATUSES = ["pending", "in_progress", "on_hold", "completed"];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available: { bg: "#dcfce7", text: "#16a34a" },
  in_transit: { bg: "#fef3c7", text: "#d97706" },
  pdi_pending: { bg: "#dbeafe", text: "#1d4ed8" },
  sold: { bg: "#f1f5f9", text: "#64748b" },
  queued: { bg: "#dbeafe", text: "#1d4ed8" },
  "in-progress": { bg: "#fef9c3", text: "#ca8a04" },
  in_progress: { bg: "#fef9c3", text: "#ca8a04" },
  finished: { bg: "#dcfce7", text: "#16a34a" },
  completed: { bg: "#dcfce7", text: "#16a34a" },
  passed: { bg: "#dcfce7", text: "#16a34a" },
  failed: { bg: "#fee2e2", text: "#dc2626" },
  on_hold: { bg: "#f1f5f9", text: "#64748b" },
  pending: { bg: "#ede9fe", text: "#7c3aed" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#f1f5f9", text: "#64748b" };
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.text }]}>
        {status.replace(/_/g, " ").replace(/-/g, " ")}
      </Text>
    </View>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────

function BottomSheet({
  visible, onClose, title, children, colors,
}: {
  visible: boolean; onClose: () => void; title: string;
  children: React.ReactNode; colors: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideY, {
        toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: SCREEN_H, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, transform: [{ translateY: slideY }] }]}
      >
        <View style={[s.sheetHeader, { borderBottomColor: colors.border }]}>
          <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[s.sheetTitle, { color: colors.foreground }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, colors }: { label: string; value: string | number | null | undefined; colors: ReturnType<typeof useColors> }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.infoValue, { color: colors.foreground }]}>{String(value)}</Text>
    </View>
  );
}

function SectionTitle({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>;
}

function ActionButton({
  label, icon, color, bg, onPress, loading,
}: {
  label: string; icon: React.ComponentProps<typeof Feather>["name"];
  color: string; bg: string; onPress: () => void; loading?: boolean;
}) {
  return (
    <Pressable style={[s.actionBtn, { backgroundColor: bg }]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator size="small" color={color} /> : <Feather name={icon} size={15} color={color} />}
      <Text style={[s.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Vehicle Detail ───────────────────────────────────────────────────────────

function VehicleDetailSheet({
  vehicleId, onClose, onRefresh, colors,
}: {
  vehicleId: number | null; onClose: () => void; onRefresh: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [detail, setDetail] = useState<VehicleDetail | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedLocId, setSelectedLocId] = useState<number | null>(null);
  const [transferNote, setTransferNote] = useState("");

  useEffect(() => {
    if (!vehicleId) return;
    setLoading(true);
    Promise.all([
      fetch(`${BASE}/yard/vehicles/${vehicleId}`).then(r => r.json()),
      fetch(`${BASE}/admin/locations`).then(r => r.json()),
    ]).then(([v, locs]) => {
      setDetail(v);
      setLocations(Array.isArray(locs) ? locs : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [vehicleId]);

  const changeStatus = async (newStatus: string) => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/yard/vehicles/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, actor: "Admin" }),
      });
      if (!res.ok) { Alert.alert("Error", "Failed to update status."); return; }
      const updated = await res.json();
      setDetail(d => d ? { ...d, status: updated.status } : d);
      onRefresh();
    } catch { Alert.alert("Error", "Network error."); } finally { setSaving(false); }
  };

  const initTransfer = async () => {
    if (!detail || !selectedLocId) { Alert.alert("Select a destination location."); return; }
    if (selectedLocId === detail.locationId) { Alert.alert("Destination must differ from current location."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/yard/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: detail.id,
          fromLocationId: detail.locationId,
          toLocationId: selectedLocId,
          requestedBy: "Admin",
          notes: transferNote || null,
        }),
      });
      if (!res.ok) { Alert.alert("Error", "Failed to create transfer."); return; }
      Alert.alert("Transfer Created", "The transfer request has been submitted.");
      setShowTransfer(false);
      onRefresh();
    } catch { Alert.alert("Error", "Network error."); } finally { setSaving(false); }
  };

  return (
    <BottomSheet visible={!!vehicleId} onClose={onClose} title="Vehicle Detail" colors={colors}>
      {loading || !detail ? (
        <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.detailCardHeader}>
              <Text style={[s.detailTitle, { color: colors.foreground }]}>
                {detail.year} {detail.make} {detail.model}
              </Text>
              <StatusBadge status={detail.status} />
            </View>
            <SectionTitle title="Vehicle Info" colors={colors} />
            <InfoRow label="Stock #" value={detail.stockNumber} colors={colors} />
            <InfoRow label="VIN" value={detail.vin} colors={colors} />
            <InfoRow label="Color" value={detail.color} colors={colors} />
            <InfoRow label="Mileage" value={detail.mileage ? `${detail.mileage.toLocaleString()} km` : null} colors={colors} />
            <InfoRow label="Condition" value={detail.condition} colors={colors} />
            <InfoRow label="Price" value={detail.price ? `$${detail.price.toLocaleString()}` : null} colors={colors} />
            <InfoRow label="Arrived" value={detail.arrivedAt ? formatDate(detail.arrivedAt) : null} colors={colors} />
            <SectionTitle title="Location" colors={colors} />
            <InfoRow label="Location" value={detail.locationName} colors={colors} />
            <InfoRow label="Zone" value={detail.zoneName} colors={colors} />
            <InfoRow label="Spot" value={detail.spotCode} colors={colors} />
          </View>

          <SectionTitle title="Change Status" colors={colors} />
          <View style={s.statusGrid}>
            {VEHICLE_STATUSES.map(st => (
              <Pressable
                key={st}
                onPress={() => changeStatus(st)}
                disabled={detail.status === st || saving}
                style={[s.statusChip, {
                  backgroundColor: detail.status === st ? (STATUS_COLORS[st]?.bg ?? "#f1f5f9") : colors.card,
                  borderColor: detail.status === st ? (STATUS_COLORS[st]?.text ?? "#64748b") : colors.border,
                  opacity: detail.status === st ? 1 : 0.85,
                }]}
              >
                {saving && detail.status !== st ? (
                  <ActivityIndicator size="small" color={STATUS_COLORS[st]?.text ?? "#64748b"} />
                ) : null}
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: STATUS_COLORS[st]?.text ?? "#64748b" }}>
                  {detail.status === st ? "✓ " : ""}{st.replace(/_/g, " ")}
                </Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle title="Transfer Vehicle" colors={colors} />
          {!showTransfer ? (
            <ActionButton
              label="Initiate Transfer" icon="arrow-right-circle"
              color="#1d4ed8" bg="#dbeafe"
              onPress={() => setShowTransfer(true)}
            />
          ) : (
            <View style={[s.transferBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.transferLabel, { color: colors.foreground }]}>Destination Location</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {locations.filter(l => l.id !== detail.locationId).map(l => (
                    <Pressable
                      key={l.id}
                      onPress={() => setSelectedLocId(l.id)}
                      style={[s.locChip, {
                        backgroundColor: selectedLocId === l.id ? "#1d4ed8" : colors.background,
                        borderColor: selectedLocId === l.id ? "#1d4ed8" : colors.border,
                      }]}
                    >
                      <Text style={{ color: selectedLocId === l.id ? "#fff" : colors.foreground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                        {l.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <TextInput
                style={[s.noteInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Notes (optional)" placeholderTextColor={colors.mutedForeground}
                value={transferNote} onChangeText={setTransferNote} multiline
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Pressable style={[s.btn, { backgroundColor: "#1d4ed8", flex: 1 }]} onPress={initTransfer} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>Confirm Transfer</Text>}
                </Pressable>
                <Pressable style={[s.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={() => setShowTransfer(false)}>
                  <Text style={[s.btnText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </BottomSheet>
  );
}

// ─── Inspection Detail ────────────────────────────────────────────────────────

function InspectionDetailSheet({
  inspectionId, onClose, onRefresh, colors,
}: {
  inspectionId: number | null; onClose: () => void; onRefresh: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [selectedTech, setSelectedTech] = useState<string | null>(null);

  useEffect(() => {
    if (!inspectionId) return;
    setLoading(true);
    Promise.all([
      fetch(`${BASE}/yard/inspections/${inspectionId}`).then(r => r.json()),
      fetch(`${BASE}/yard/inspections/available-techs`).then(r => r.json()),
    ]).then(([insp, t]) => {
      setDetail(insp);
      setTechs(Array.isArray(t) ? t : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [inspectionId]);

  const patchInspection = async (body: Record<string, unknown>) => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/yard/inspections/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { Alert.alert("Error", "Failed to update inspection."); return; }
      const updated = await res.json();
      setDetail(d => d ? { ...d, ...updated } : d);
      onRefresh();
    } catch { Alert.alert("Error", "Network error."); } finally { setSaving(false); }
  };

  const reassign = async () => {
    await patchInspection({ assignedTo: selectedTech || null });
    setShowReassign(false);
  };

  const typeLabel = (t: string) => t.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <BottomSheet visible={!!inspectionId} onClose={onClose} title="Inspection Detail" colors={colors}>
      {loading || !detail ? (
        <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.detailCardHeader}>
              <Text style={[s.detailTitle, { color: colors.foreground }]}>#{detail.inspectionNumber}</Text>
              <StatusBadge status={detail.status} />
            </View>
            <SectionTitle title="Inspection Info" colors={colors} />
            <InfoRow label="Vehicle" value={detail.vehicleName} colors={colors} />
            <InfoRow label="Type" value={typeLabel(detail.type)} colors={colors} />
            <InfoRow label="Location" value={detail.locationName} colors={colors} />
            <InfoRow label="Assigned To" value={detail.assignedTo ?? "Unassigned"} colors={colors} />
            <InfoRow label="Created" value={formatDate(detail.createdAt)} colors={colors} />
            <InfoRow label="Completed" value={detail.completedAt ? formatDate(detail.completedAt) : "—"} colors={colors} />
            <InfoRow label="Fuel" value={detail.fuelPercentage != null ? `${detail.fuelPercentage}%` : null} colors={colors} />
            {detail.notes ? (
              <>
                <SectionTitle title="Notes" colors={colors} />
                <Text style={[s.noteText, { color: colors.foreground }]}>{detail.notes}</Text>
              </>
            ) : null}
            {detail.bodyDamage ? (
              <>
                <SectionTitle title="Body Damage" colors={colors} />
                <Text style={[s.noteText, { color: colors.destructive ?? "#ef4444" }]}>{detail.bodyDamage}</Text>
              </>
            ) : null}
          </View>

          <SectionTitle title="Admin Actions" colors={colors} />
          <View style={s.actionRow}>
            {detail.status === "queued" && (
              <ActionButton label="Start" icon="play" color="#d97706" bg="#fef3c7"
                onPress={() => patchInspection({ status: "in-progress" })} loading={saving} />
            )}
            {(detail.status === "queued" || detail.status === "in-progress") && (
              <ActionButton label="Mark Passed" icon="check-circle" color="#16a34a" bg="#dcfce7"
                onPress={() => patchInspection({ status: "finished", completedAt: new Date().toISOString() })} loading={saving} />
            )}
            {(detail.status === "queued" || detail.status === "in-progress") && (
              <ActionButton label="Cancel" icon="x-circle" color="#dc2626" bg="#fee2e2"
                onPress={() => Alert.alert("Cancel Inspection", "Mark this inspection as cancelled?", [
                  { text: "No", style: "cancel" },
                  { text: "Yes", onPress: () => patchInspection({ status: "finished", notes: (detail.notes ?? "") + "\n[Cancelled by Admin]" }) },
                ])} loading={saving} />
            )}
          </View>

          <SectionTitle title="Reassign Technician" colors={colors} />
          {!showReassign ? (
            <ActionButton label="Reassign" icon="user-check" color="#7c3aed" bg="#ede9fe"
              onPress={() => { setSelectedTech(detail.assignedTo); setShowReassign(true); }} />
          ) : (
            <View style={[s.transferBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.transferLabel, { color: colors.foreground }]}>Select Technician</Text>
              <Pressable
                onPress={() => setSelectedTech(null)}
                style={[s.locChip, {
                  backgroundColor: selectedTech === null ? "#dc2626" : colors.background,
                  borderColor: selectedTech === null ? "#dc2626" : colors.border,
                  marginBottom: 8,
                }]}
              >
                <Text style={{ color: selectedTech === null ? "#fff" : colors.foreground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                  Unassigned
                </Text>
              </Pressable>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {techs.map(t => (
                    <Pressable
                      key={t.id}
                      onPress={() => setSelectedTech(t.userCode)}
                      style={[s.locChip, {
                        backgroundColor: selectedTech === t.userCode ? "#7c3aed" : colors.background,
                        borderColor: selectedTech === t.userCode ? "#7c3aed" : colors.border,
                      }]}
                    >
                      <Text style={{ color: selectedTech === t.userCode ? "#fff" : colors.foreground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                        {t.name} ({t.userCode})
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable style={[s.btn, { backgroundColor: "#7c3aed", flex: 1 }]} onPress={reassign} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>Confirm</Text>}
                </Pressable>
                <Pressable style={[s.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={() => setShowReassign(false)}>
                  <Text style={[s.btnText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </BottomSheet>
  );
}

// ─── Job Detail ───────────────────────────────────────────────────────────────

function JobDetailSheet({
  jobId, onClose, onRefresh, colors,
}: {
  jobId: string | null; onClose: () => void; onRefresh: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progressInput, setProgressInput] = useState("");

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    fetch(`${BASE}/jobs/${jobId}`)
      .then(r => r.json())
      .then(d => {
        const j = d.job ?? d;
        setDetail(j);
        setProgressInput(String(j.progress ?? 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  const patchJob = async (body: Record<string, unknown>) => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/jobs/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { Alert.alert("Error", "Failed to update job."); return; }
      const updated = await res.json();
      const j = updated.job ?? updated;
      setDetail(prev => prev ? { ...prev, ...j } : prev);
      setProgressInput(String(j.progress ?? detail.progress));
      onRefresh();
    } catch { Alert.alert("Error", "Network error."); } finally { setSaving(false); }
  };

  const saveProgress = () => {
    const val = parseInt(progressInput, 10);
    if (isNaN(val) || val < 0 || val > 100) { Alert.alert("Enter a number 0–100."); return; }
    patchJob({ progress: val });
  };

  const tasksDone = detail?.tasks.filter(t => t.status === "done").length ?? 0;
  const tasksTotal = detail?.tasks.length ?? 0;

  return (
    <BottomSheet visible={!!jobId} onClose={onClose} title="Job Detail" colors={colors}>
      {loading || !detail ? (
        <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.detailCardHeader}>
              <Text style={[s.detailTitle, { color: colors.foreground }]}>{detail.estimateNumber}</Text>
              <StatusBadge status={detail.status} />
            </View>
            <SectionTitle title="Job Info" colors={colors} />
            <InfoRow label="Vehicle" value={`${detail.vehicleYear} ${detail.vehicleMake} ${detail.vehicleModel}`} colors={colors} />
            <InfoRow label="Plate" value={detail.licensePlate} colors={colors} />
            <InfoRow label="Technician" value={detail.assignedTechnicianId ?? "Unassigned"} colors={colors} />
            <InfoRow label="Service Advisor" value={detail.serviceAdvisor} colors={colors} />
            <InfoRow label="Appointment" value={detail.appointmentDate ? formatDate(detail.appointmentDate) : null} colors={colors} />
            <InfoRow label="Created" value={formatDate(detail.createdAt)} colors={colors} />
            <InfoRow label="Worked Hours" value={detail.workedHours ? `${detail.workedHours}h` : null} colors={colors} />
            <InfoRow label="Tasks" value={tasksTotal > 0 ? `${tasksDone}/${tasksTotal} done` : null} colors={colors} />

            {/* Progress bar */}
            <SectionTitle title="Progress" colors={colors} />
            <View style={s.progressRow}>
              <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
                <View style={[s.progressFill, { width: `${detail.progress}%` as `${number}%`, backgroundColor: "#dc2626" }]} />
              </View>
              <Text style={[s.progressPct, { color: colors.foreground }]}>{detail.progress}%</Text>
            </View>
          </View>

          {/* Tasks list */}
          {detail.tasks.length > 0 && (
            <>
              <SectionTitle title={`Tasks (${tasksDone}/${tasksTotal})`} colors={colors} />
              {detail.tasks.map(t => (
                <View key={t.id} style={[s.taskRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather
                    name={t.status === "done" ? "check-circle" : "circle"}
                    size={15} color={t.status === "done" ? "#16a34a" : colors.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.taskTitle, { color: colors.foreground }]}>{t.title}</Text>
                    {t.assignedTo && <Text style={[s.taskMeta, { color: colors.mutedForeground }]}>{t.assignedTo}</Text>}
                  </View>
                  <StatusBadge status={t.status} />
                </View>
              ))}
            </>
          )}

          {/* Admin actions */}
          <SectionTitle title="Admin Actions" colors={colors} />

          {/* Status buttons */}
          <View style={s.statusGrid}>
            {JOB_STATUSES.map(st => (
              <Pressable
                key={st}
                onPress={() => patchJob({ status: st })}
                disabled={detail.status === st || saving}
                style={[s.statusChip, {
                  backgroundColor: detail.status === st ? (STATUS_COLORS[st]?.bg ?? "#f1f5f9") : colors.card,
                  borderColor: detail.status === st ? (STATUS_COLORS[st]?.text ?? "#64748b") : colors.border,
                }]}
              >
                <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: STATUS_COLORS[st]?.text ?? "#64748b" }}>
                  {detail.status === st ? "✓ " : ""}{st.replace(/_/g, " ")}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Progress adjustment */}
          <SectionTitle title="Adjust Progress" colors={colors} />
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              style={[s.progressInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={progressInput} onChangeText={setProgressInput}
              keyboardType="numeric" maxLength={3}
              placeholder="0–100"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14 }]}>%</Text>
            <Pressable style={[s.btn, { backgroundColor: "#dc2626", flex: 1 }]} onPress={saveProgress} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>Save Progress</Text>}
            </Pressable>
          </View>

          {/* Notes */}
          {detail.notes && detail.notes.length > 0 && (
            <>
              <SectionTitle title="Notes" colors={colors} />
              {detail.notes.slice(0, 5).map(n => (
                <View key={n.id} style={[s.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[s.noteText, { color: colors.foreground }]}>{n.text}</Text>
                  <Text style={[s.noteMeta, { color: colors.mutedForeground }]}>{n.author} · {formatDate(n.createdAt)}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </BottomSheet>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminMonitorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("vehicles");
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected items for detail sheets
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [vRes, iRes, jRes] = await Promise.all([
        fetch(`${BASE}/admin/monitor/vehicles?limit=50`),
        fetch(`${BASE}/admin/monitor/inspections?limit=50`),
        fetch(`${BASE}/admin/monitor/jobs?limit=50`),
      ]);
      if (vRes.ok) { const d = await vRes.json(); setVehicles(d.vehicles ?? d); }
      if (iRes.ok) { const d = await iRes.json(); setInspections(d.inspections ?? d); }
      if (jRes.ok) { const d = await jRes.json(); setJobs(d.jobs ?? d); }
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const tabs: { key: Tab; label: string; count: number; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
    { key: "vehicles", label: "Vehicles", count: vehicles.length, icon: "truck" },
    { key: "inspections", label: "Inspections", count: inspections.length, icon: "clipboard" },
    { key: "jobs", label: "Jobs", count: jobs.length, icon: "briefcase" },
  ];

  const formatDate2 = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="System Monitor" subtitle="Tap any item to manage it" />

      <View style={[s.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {tabs.map(t => (
          <Pressable
            key={t.key}
            style={[s.tab, tab === t.key && { borderBottomColor: "#dc2626", borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
          >
            <Feather name={t.icon} size={14} color={tab === t.key ? "#dc2626" : colors.mutedForeground} />
            <Text style={[s.tabLabel, { color: tab === t.key ? "#dc2626" : colors.mutedForeground }]}>
              {t.label}
            </Text>
            <View style={[s.tabCount, { backgroundColor: tab === t.key ? "#fee2e2" : colors.muted }]}>
              <Text style={{ fontSize: 10, color: tab === t.key ? "#dc2626" : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }}>
                {t.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
        ) : tab === "vehicles" ? (
          vehicles.length === 0
            ? <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No vehicles.</Text>
            : vehicles.map(v => (
              <Pressable
                key={v.id}
                style={({ pressed }) => [s.row, { backgroundColor: pressed ? colors.accent ?? colors.muted : colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedVehicleId(v.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: colors.foreground }]}>{v.year} {v.make} {v.model}</Text>
                  <Text style={[s.rowSub, { color: colors.mutedForeground }]}>
                    #{v.stockNumber} · {v.locationName ?? "No location"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StatusBadge status={v.status} />
                  <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                </View>
              </Pressable>
            ))
        ) : tab === "inspections" ? (
          inspections.length === 0
            ? <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No inspections.</Text>
            : inspections.map(i => (
              <Pressable
                key={i.id}
                style={({ pressed }) => [s.row, { backgroundColor: pressed ? colors.accent ?? colors.muted : colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedInspectionId(i.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: colors.foreground }]}>{i.inspectionNumber}</Text>
                  <Text style={[s.rowSub, { color: colors.mutedForeground }]}>
                    {i.vehicleName} · {i.assignedTo ?? "Unassigned"} · {formatDate2(i.createdAt)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StatusBadge status={i.status} />
                  <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                </View>
              </Pressable>
            ))
        ) : (
          jobs.length === 0
            ? <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No jobs.</Text>
            : jobs.map(j => (
              <Pressable
                key={j.id}
                style={({ pressed }) => [s.row, { backgroundColor: pressed ? colors.accent ?? colors.muted : colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedJobId(j.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: colors.foreground }]}>{j.estimateNumber}</Text>
                  <Text style={[s.rowSub, { color: colors.mutedForeground }]}>
                    {j.vehicleYear} {j.vehicleMake} {j.vehicleModel} · {formatDate2(j.createdAt)}
                  </Text>
                  {/* Progress bar */}
                  <View style={[s.miniProgressTrack, { backgroundColor: colors.border }]}>
                    <View style={[s.miniProgressFill, { width: `${j.progress}%` as `${number}%` }]} />
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StatusBadge status={j.status} />
                  <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                </View>
              </Pressable>
            ))
        )}
      </ScrollView>

      {/* Detail bottom sheets */}
      <VehicleDetailSheet
        vehicleId={selectedVehicleId}
        onClose={() => setSelectedVehicleId(null)}
        onRefresh={load}
        colors={colors}
      />
      <InspectionDetailSheet
        inspectionId={selectedInspectionId}
        onClose={() => setSelectedInspectionId(null)}
        onRefresh={load}
        colors={colors}
      />
      <JobDetailSheet
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onRefresh={load}
        colors={colors}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12 },
  tabLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tabCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    borderRadius: 10, borderWidth: 1, marginBottom: 8,
  },
  rowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  miniProgressTrack: { height: 3, borderRadius: 2, marginTop: 5, overflow: "hidden" },
  miniProgressFill: { height: 3, borderRadius: 2, backgroundColor: "#dc2626" },

  // Bottom sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: SCREEN_H * 0.88, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 8, marginBottom: 12 },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },

  // Detail card
  detailCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 2 },
  detailCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  detailTitle: { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1, marginRight: 8 },
  sectionTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "right", flex: 1, marginLeft: 8 },

  // Actions
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },

  // Transfer / reassign box
  transferBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  transferLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  locChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  noteInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 56 },

  // Buttons
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Progress
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  progressPct: { fontSize: 13, fontFamily: "Inter_700Bold", width: 38, textAlign: "right" },
  progressInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontFamily: "Inter_500Medium", width: 60, textAlign: "center" },

  // Tasks
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 6 },
  taskTitle: { fontSize: 13, fontFamily: "Inter_500Medium" },
  taskMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Notes
  noteCard: { borderRadius: 8, borderWidth: 1, padding: 10, marginBottom: 6 },
  noteText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  noteMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
});
