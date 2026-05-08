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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

type VehicleStatus = "available" | "in_transit" | "pdi_pending" | "sold";
type Urgency = "overdue" | "due-soon" | "ok";

interface VehicleDetail {
  id: number;
  stockNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin: string;
  status: VehicleStatus;
  mileage?: number;
  price?: number | null;
  condition: string;
  locationName?: string;
  spotCode?: string;
  arrivedAt?: string;
  inspectionIntervalDays?: number;
}

interface InspectionRec {
  vehicleId: number;
  urgency: Urgency;
  daysRemaining: number;
  nextDueDate: string;
  lastInspectedAt: string | null;
  lastInspectionType: string | null;
  lastInspectionTechnician: string | null;
  aiRecommendation: string;
  daysSinceArrival: number;
  inspectionIntervalDays: number;
}

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  "pre-inspection": "Pre-Inspection",
  secondary: "Secondary",
  "final-quality": "Final Quality",
  "new-arrival": "New Arrival PDI",
  "used-arrival": "Used Arrival PDI",
  "periodic-fluid": "Periodic — Fluid Check",
  "periodic-damage": "Periodic — Damage Scan",
  "start-and-run": "Start & Run Cycle",
};

const STATUS_LABEL: Record<VehicleStatus, string> = {
  available: "Available",
  in_transit: "In Transit",
  pdi_pending: "PDI Pending",
  sold: "Sold",
};
const STATUS_COLOR: Record<VehicleStatus, string> = {
  available: "#16a34a",
  in_transit: "#d97706",
  pdi_pending: "#1d4ed8",
  sold: "#64748b",
};
const STATUS_BG: Record<VehicleStatus, string> = {
  available: "#dcfce7",
  in_transit: "#fef3c7",
  pdi_pending: "#dbeafe",
  sold: "#f1f5f9",
};
const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "#dc2626",
  "due-soon": "#d97706",
  ok: "#16a34a",
};
const URGENCY_BG: Record<Urgency, string> = {
  overdue: "#fef2f2",
  "due-soon": "#fffbeb",
  ok: "#f0fdf4",
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  const colors = useColors();
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{String(value)}</Text>
    </View>
  );
}

export default function VehicleDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { role } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Permissions
  const canViewPrice = role === "supervisor";

  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [rec, setRec] = useState<InspectionRec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`${BASE}/yard/vehicles/${id}`).then((r) => r.json()),
      fetch(`${BASE}/yard/inspection-recommendations`).then((r) => r.json()),
    ])
      .then(([vehicleData, recData]) => {
        setVehicle(vehicleData);
        const found = (recData.recommendations ?? []).find(
          (r: InspectionRec) => r.vehicleId === Number(id)
        );
        setRec(found ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [id]);

  const startPDI = () => {
    router.push({ pathname: "/yard/new-inspection", params: { vehicleId: id } });
  };

  const viewHistory = () => {
    const name = vehicle
      ? encodeURIComponent(`${vehicle.year} ${vehicle.make} ${vehicle.model}`)
      : "";
    router.push({ pathname: "/yard/inspection-history", params: { id, vehicleName: name } });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Vehicle Detail" showBack showNotifications={false} />
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </View>
    );
  }

  if (error || !vehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Vehicle Detail" showBack showNotifications={false} />
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Vehicle not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        subtitle={`Stock #${vehicle.stockNumber}`}
        showBack
        showNotifications={false}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: STATUS_BG[vehicle.status] }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[vehicle.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLOR[vehicle.status] }]}>
            {STATUS_LABEL[vehicle.status]}
          </Text>
        </View>

        {/* AI Inspection Recommendation card */}
        {rec && vehicle.status !== "sold" && (
          <View style={[styles.recCard, { backgroundColor: URGENCY_BG[rec.urgency], borderColor: URGENCY_COLOR[rec.urgency] + "40" }]}>
            <View style={styles.recHeader}>
              <Feather
                name={rec.urgency === "overdue" ? "alert-circle" : rec.urgency === "due-soon" ? "clock" : "check-circle"}
                size={16}
                color={URGENCY_COLOR[rec.urgency]}
              />
              <Text style={[styles.recTitle, { color: URGENCY_COLOR[rec.urgency] }]}>
                {rec.urgency === "overdue"
                  ? `Inspection Overdue by ${Math.abs(rec.daysRemaining)} day${Math.abs(rec.daysRemaining) !== 1 ? "s" : ""}`
                  : rec.urgency === "due-soon"
                  ? `Inspection Due in ${rec.daysRemaining} day${rec.daysRemaining !== 1 ? "s" : ""}`
                  : `Next Inspection in ${rec.daysRemaining} days`}
              </Text>
            </View>
            <Text style={[styles.recText, { color: URGENCY_COLOR[rec.urgency] }]}>{rec.aiRecommendation}</Text>
            <View style={styles.recMeta}>
              <Text style={[styles.recMetaText, { color: URGENCY_COLOR[rec.urgency] + "bb" }]}>
                Cycle: every {rec.inspectionIntervalDays} days
              </Text>
              {rec.lastInspectedAt ? (
                <Text style={[styles.recMetaText, { color: URGENCY_COLOR[rec.urgency] + "bb" }]}>
                  Last: {new Date(rec.lastInspectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </Text>
              ) : (
                <Text style={[styles.recMetaText, { color: URGENCY_COLOR[rec.urgency] + "bb" }]}>
                  Last: Never
                </Text>
              )}
              <Text style={[styles.recMetaText, { color: URGENCY_COLOR[rec.urgency] + "bb" }]}>
                Due: {new Date(rec.nextDueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
              {rec.lastInspectionType && (
                <Text style={[styles.recMetaText, { color: URGENCY_COLOR[rec.urgency] + "bb" }]}>
                  Type: {INSPECTION_TYPE_LABELS[rec.lastInspectionType] ?? rec.lastInspectionType}
                </Text>
              )}
              {rec.lastInspectionTechnician && (
                <Text style={[styles.recMetaText, { color: URGENCY_COLOR[rec.urgency] + "bb" }]}>
                  Tech: {rec.lastInspectionTechnician}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Vehicle details card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle Details</Text>
          <InfoRow label="Make" value={vehicle.make} />
          <InfoRow label="Model" value={vehicle.model} />
          <InfoRow label="Year" value={vehicle.year} />
          <InfoRow label="Color" value={vehicle.color} />
          <InfoRow label="Condition" value={vehicle.condition ? vehicle.condition.charAt(0).toUpperCase() + vehicle.condition.slice(1) : undefined} />
          <InfoRow label="Mileage" value={vehicle.mileage !== undefined ? `${vehicle.mileage.toLocaleString()} km` : undefined} />
        </View>

        {/* Stock & location card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Stock & Location</Text>
          <InfoRow label="Stock Number" value={vehicle.stockNumber} />
          <InfoRow label="VIN" value={vehicle.vin} />
          <InfoRow label="Location" value={vehicle.locationName} />
          <InfoRow label="Spot" value={vehicle.spotCode} />
          <InfoRow label="Arrived" value={vehicle.arrivedAt ? new Date(vehicle.arrivedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : undefined} />
          {/* Price only shown to supervisors */}
          {canViewPrice && vehicle.price != null && (
            <InfoRow label="Price" value={`QAR ${Number(vehicle.price).toLocaleString()}`} />
          )}
          {!canViewPrice && vehicle.price != null && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Price</Text>
              <View style={styles.restrictedBadge}>
                <Feather name="lock" size={10} color={colors.mutedForeground} />
                <Text style={[styles.restrictedText, { color: colors.mutedForeground }]}>Management only</Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Actions</Text>

          {/* Inspection history — always available */}
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "#7c3aed" }]}
            onPress={viewHistory}
          >
            <Feather name="clock" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Inspection History</Text>
          </Pressable>

          {/* Check service plan — always available when VIN is known */}
          {vehicle.vin ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#1d4ed8" }]}
              onPress={() => router.push({ pathname: "/plans", params: { vin: vehicle.vin } })}
            >
              <Feather name="credit-card" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Check Service Plan</Text>
            </Pressable>
          ) : null}

          {vehicle.status !== "sold" && (vehicle.status === "available" || vehicle.status === "in_transit") && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={startPDI}
            >
              <Feather name="clipboard" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Start PDI Inspection</Text>
            </Pressable>
          )}

          {vehicle.status === "pdi_pending" && (
            <View style={[styles.infoBanner, { backgroundColor: colors.accent }]}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.infoBannerText, { color: colors.primary }]}>
                PDI inspection in progress for this vehicle
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  content: { padding: 16, gap: 12 },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  recCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  recHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  recText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  recMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  recMetaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 2,
    textAlign: "right",
  },
  restrictedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  restrictedText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 4,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  infoBannerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
});
