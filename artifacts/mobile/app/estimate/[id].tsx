import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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
import type { EstimateLine, EstimateStatus } from "@/context/EstimatesContext";
import { useEstimates } from "@/context/EstimatesContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const BASE_URL =
  Platform.OS === "web"
    ? ""
    : `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "localhost"}`;

const STATUS_NEXT: Partial<Record<EstimateStatus, EstimateStatus>> = {
  pending_inspection:       "inspection_in_progress",
  inspection_in_progress:   "review",
  review:                   "approved",
  approved:                 "submitted",
};

const STATUS_CONFIG: Record<EstimateStatus, { color: string; bg: string; label: string }> = {
  pending_inspection:       { color: "#d97706", bg: "#fef3c7", label: "Pending Inspection" },
  inspection_in_progress:   { color: "#2563eb", bg: "#dbeafe", label: "In Progress" },
  review:                   { color: "#7c3aed", bg: "#ede9fe", label: "Under Review" },
  approved:                 { color: "#16a34a", bg: "#dcfce7", label: "Approved" },
  submitted:                { color: "#64748b", bg: "#f1f5f9", label: "Submitted to DMS" },
};

const LINE_TYPE_CONFIG = {
  labor:    { color: "#2563eb", bg: "#eff6ff", icon: "tool" as const,    label: "Labour" },
  part:     { color: "#7c3aed", bg: "#f5f3ff", icon: "package" as const, label: "Parts" },
  material: { color: "#d97706", bg: "#fffbeb", icon: "droplet" as const, label: "Materials" },
};

function LineRow({ line, onRemove, currency }: { line: EstimateLine; onRemove: () => void; currency: string }) {
  const colors = useColors();
  const cfg = LINE_TYPE_CONFIG[line.type];
  return (
    <View style={[styles.lineRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.lineTypeTag, { backgroundColor: cfg.bg }]}>
        <Feather name={cfg.icon} size={10} color={cfg.color} />
        <Text style={[styles.lineTypeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
      <View style={styles.lineBody}>
        <View style={styles.lineTop}>
          <Text style={[styles.lineDesc, { color: colors.foreground }]} numberOfLines={2}>
            {line.description}
            {line.aiGenerated ? (
              <Text style={styles.aiTag}> ✦ AI</Text>
            ) : null}
          </Text>
          <Pressable onPress={onRemove} hitSlop={8}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <View style={styles.lineBottom}>
          {line.type === "labor" && line.hours !== undefined && (
            <Text style={[styles.lineMeta, { color: colors.mutedForeground }]}>
              {line.hours}h × {currency}{line.unitPrice.toFixed(2)}/h
            </Text>
          )}
          {line.type !== "labor" && line.quantity !== undefined && (
            <Text style={[styles.lineMeta, { color: colors.mutedForeground }]}>
              Qty {line.quantity} × {currency}{line.unitPrice.toFixed(2)}
            </Text>
          )}
          <Text style={[styles.lineTotal, { color: cfg.color }]}>
            {currency}{line.total.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function EstimateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getEstimate, updateStatus, removeLine, setLines, addPhoto } = useEstimates();
  const { t } = useLang();
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const estimate = getEstimate(id ?? "");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  if (!estimate) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title={t.estimate} showBack />
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
          <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Estimate not found.</Text>
        </View>
      </View>
    );
  }

  const cfg = STATUS_CONFIG[estimate.status];
  const laborLines   = estimate.lines.filter((l) => l.type === "labor");
  const partLines    = estimate.lines.filter((l) => l.type === "part");
  const materialLines= estimate.lines.filter((l) => l.type === "material");
  const laborTotal   = laborLines.reduce((s, l) => s + l.total, 0);
  const partsTotal   = partLines.reduce((s, l) => s + l.total, 0);
  const materialsTotal = materialLines.reduce((s, l) => s + l.total, 0);
  const grandTotal   = laborTotal + partsTotal + materialsTotal;
  const currency     = "$";

  const canAnalyse  = estimate.status !== "submitted" && estimate.status !== "approved";
  const canSubmit   = estimate.status === "review" || estimate.status === "inspection_in_progress";
  const canApprove  = estimate.status === "review" || (estimate.lines.length > 0 && estimate.status === "inspection_in_progress");

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      const camStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus.status !== "granted") {
        Alert.alert("Permission Required", "Camera or photo library permission is needed.");
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.75,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 ?? null);
      setAnalysisError(null);
      if (estimate.status === "pending_inspection") {
        updateStatus(estimate.id, "inspection_in_progress");
      }
      addPhoto(estimate.id, { uri: asset.uri, capturedAt: new Date().toISOString() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [estimate, updateStatus, addPhoto]);

  const handlePickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.75,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 ?? null);
      setAnalysisError(null);
      if (estimate.status === "pending_inspection") {
        updateStatus(estimate.id, "inspection_in_progress");
      }
      addPhoto(estimate.id, { uri: asset.uri, capturedAt: new Date().toISOString() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [estimate, updateStatus, addPhoto]);

  const handleAnalyse = useCallback(async () => {
    setIsAnalysing(true);
    setAnalysisError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const apiBase = BASE_URL || "http://localhost:80";
      const response = await fetch(`${apiBase}/api/estimates/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleInfo: `${estimate.year} ${estimate.make} ${estimate.model} (${estimate.odometer})`,
          damageNotes: estimate.damageNotes,
          imageBase64: photoBase64 ?? undefined,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `Server error ${response.status}`);
      }
      const data = await response.json() as { lines: EstimateLine[] };
      setLines(estimate.id, data.lines);
      updateStatus(estimate.id, "review");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setAnalysisError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalysing(false);
    }
  }, [estimate, photoBase64, setLines, updateStatus]);

  const handleAdvanceStatus = useCallback(() => {
    const next = STATUS_NEXT[estimate.status];
    if (next) {
      updateStatus(estimate.id, next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (next === "submitted") {
        Alert.alert("Submitted", `${estimate.estimateNo} has been submitted to the DMS.`);
        router.back();
      }
    }
  }, [estimate, updateStatus, router]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title={t.estimate} subtitle={estimate.estimateNo} showBack />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status */}
        <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        {/* Vehicle card */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.vehicle}</Text>
          <View style={styles.vehicleGrid}>
            {[
              { label: t.make,  value: estimate.make },
              { label: t.model, value: estimate.model },
              { label: t.year,  value: estimate.year },
              { label: "Plate", value: estimate.licensePlate },
              { label: t.customer, value: estimate.customer },
              { label: "Odometer", value: estimate.odometer },
            ].map(({ label, value }) => (
              <View key={label} style={styles.vehicleCell}>
                <Text style={[styles.vehicleCellLabel, { color: colors.mutedForeground }]}>{label}</Text>
                <Text style={[styles.vehicleCellValue, { color: colors.foreground }]}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Damage notes */}
        <View style={[styles.section, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
          <View style={styles.sectionHeader}>
            <Feather name="alert-circle" size={14} color="#d97706" />
            <Text style={[styles.sectionTitle, { color: "#d97706" }]}>{t.damageDescription}</Text>
          </View>
          <Text style={[styles.damageText, { color: "#92400e" }]}>{estimate.damageNotes}</Text>
        </View>

        {/* Photo capture */}
        {canAnalyse && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="camera" size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.aiDamageAnalysis}</Text>
              <View style={styles.aiPoweredBadge}>
                <Text style={styles.aiPoweredText}>✦ AI</Text>
              </View>
            </View>

            {photoUri ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
                <Pressable
                  onPress={handlePickPhoto}
                  style={[styles.retakeBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                >
                  <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.retakeBtnText, { color: colors.mutedForeground }]}>{t.retakePhoto}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoActions}>
                <Pressable
                  onPress={handlePickPhoto}
                  style={({ pressed }) => [styles.photoBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Feather name="camera" size={16} color="#fff" />
                  <Text style={styles.photoBtnText}>{t.takePhoto}</Text>
                </Pressable>
                <Pressable
                  onPress={handlePickFromLibrary}
                  style={({ pressed }) => [styles.photoBtnSecondary, { borderColor: colors.border, backgroundColor: colors.secondary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Feather name="image" size={16} color={colors.foreground} />
                  <Text style={[styles.photoBtnSecondaryText, { color: colors.foreground }]}>Library</Text>
                </Pressable>
              </View>
            )}

            {analysisError && (
              <View style={[styles.errorBox, { backgroundColor: "#fee2e2", borderColor: "#fca5a5" }]}>
                <Feather name="alert-circle" size={13} color="#dc2626" />
                <Text style={styles.errorText}>{analysisError}</Text>
              </View>
            )}

            <Pressable
              onPress={handleAnalyse}
              disabled={isAnalysing}
              style={({ pressed }) => [
                styles.analyseBtn,
                { backgroundColor: isAnalysing ? "#94a3b8" : "#1d4ed8", opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {isAnalysing ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.analyseBtnText}>{t.analysingDamage}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.analyseBtnIcon}>✦</Text>
                  <Text style={styles.analyseBtnText}>
                    {estimate.lines.length > 0 ? "Regenerate with AI" : t.aiDamageAnalysis}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Labour lines */}
        {laborLines.length > 0 && (
          <View style={styles.linesSection}>
            <View style={styles.linesSectionHeader}>
              <View style={[styles.linesTypeTag, { backgroundColor: "#eff6ff" }]}>
                <Feather name="tool" size={11} color="#2563eb" />
                <Text style={[styles.linesSectionTitle, { color: "#2563eb" }]}>{t.laborLines}</Text>
              </View>
              <Text style={[styles.linesSectionTotal, { color: "#2563eb" }]}>{currency}{laborTotal.toFixed(2)}</Text>
            </View>
            {laborLines.map((l) => (
              <LineRow
                key={l.id}
                line={l}
                currency={currency}
                onRemove={() => removeLine(estimate.id, l.id)}
              />
            ))}
          </View>
        )}

        {/* Parts lines */}
        {partLines.length > 0 && (
          <View style={styles.linesSection}>
            <View style={styles.linesSectionHeader}>
              <View style={[styles.linesTypeTag, { backgroundColor: "#f5f3ff" }]}>
                <Feather name="package" size={11} color="#7c3aed" />
                <Text style={[styles.linesSectionTitle, { color: "#7c3aed" }]}>{t.partsLines}</Text>
              </View>
              <Text style={[styles.linesSectionTotal, { color: "#7c3aed" }]}>{currency}{partsTotal.toFixed(2)}</Text>
            </View>
            {partLines.map((l) => (
              <LineRow
                key={l.id}
                line={l}
                currency={currency}
                onRemove={() => removeLine(estimate.id, l.id)}
              />
            ))}
          </View>
        )}

        {/* Materials lines */}
        {materialLines.length > 0 && (
          <View style={styles.linesSection}>
            <View style={styles.linesSectionHeader}>
              <View style={[styles.linesTypeTag, { backgroundColor: "#fffbeb" }]}>
                <Feather name="droplet" size={11} color="#d97706" />
                <Text style={[styles.linesSectionTitle, { color: "#d97706" }]}>{t.materialsLines}</Text>
              </View>
              <Text style={[styles.linesSectionTotal, { color: "#d97706" }]}>{currency}{materialsTotal.toFixed(2)}</Text>
            </View>
            {materialLines.map((l) => (
              <LineRow
                key={l.id}
                line={l}
                currency={currency}
                onRemove={() => removeLine(estimate.id, l.id)}
              />
            ))}
          </View>
        )}

        {/* Grand total */}
        {grandTotal > 0 && (
          <View style={[styles.totalCard, { backgroundColor: "#1d4ed8", borderColor: "#1e40af" }]}>
            <View>
              <Text style={styles.totalLabel}>{t.estimateTotal}</Text>
              <Text style={styles.totalBreakdown}>
                Labour {currency}{laborTotal.toFixed(2)}  ·  Parts {currency}{partsTotal.toFixed(2)}  ·  Materials {currency}{materialsTotal.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.totalAmount}>{currency}{grandTotal.toFixed(2)}</Text>
          </View>
        )}

        {/* Action buttons */}
        {canApprove && estimate.lines.length > 0 && (
          <Pressable
            onPress={handleAdvanceStatus}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#16a34a", opacity: pressed ? 0.85 : 1 }]}
          >
            <Feather name="check-circle" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>{t.approveEstimate}</Text>
          </Pressable>
        )}
        {estimate.status === "approved" && (
          <Pressable
            onPress={handleAdvanceStatus}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#1d4ed8", opacity: pressed ? 0.85 : 1 }]}
          >
            <Feather name="send" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>{t.submitToDMS}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1 },
  scroll:        { flex: 1 },
  content:       { padding: 16, gap: 14 },
  center:        { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  notFoundText:  { fontSize: 16, fontFamily: "Inter_400Regular" },

  statusBanner:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  statusLabel:   { fontSize: 13, fontFamily: "Inter_700Bold" },

  section:       { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionTitle:  { fontSize: 13, fontFamily: "Inter_700Bold" },

  vehicleGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 0, marginTop: 4 },
  vehicleCell:       { width: "50%", paddingVertical: 5, paddingRight: 8 },
  vehicleCellLabel:  { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 1 },
  vehicleCellValue:  { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  damageText:    { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  aiPoweredBadge:{ backgroundColor: "#dbeafe", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 2 },
  aiPoweredText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#2563eb" },

  photoContainer:{ gap: 8 },
  photoPreview:  { width: "100%", height: 200, borderRadius: 10 },
  retakeBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  retakeBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  photoActions:  { flexDirection: "row", gap: 10 },
  photoBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10 },
  photoBtnText:  { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  photoBtnSecondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  photoBtnSecondaryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  errorBox:      { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  errorText:     { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#dc2626", lineHeight: 17 },

  analyseBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  analyseBtnIcon:{ fontSize: 14, color: "#fff", fontFamily: "Inter_700Bold" },
  analyseBtnText:{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  linesSection:      { gap: 8 },
  linesSectionHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  linesTypeTag:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  linesSectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  linesSectionTotal: { fontSize: 14, fontFamily: "Inter_700Bold" },

  lineRow:       { borderRadius: 10, borderWidth: 1, padding: 10, gap: 6 },
  lineTypeTag:   { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  lineTypeText:  { fontSize: 9, fontFamily: "Inter_700Bold" },
  lineBody:      { gap: 4 },
  lineTop:       { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 },
  lineDesc:      { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 17 },
  aiTag:         { fontSize: 10, color: "#2563eb", fontFamily: "Inter_700Bold" },
  lineBottom:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lineMeta:      { fontSize: 11, fontFamily: "Inter_400Regular" },
  lineTotal:     { fontSize: 13, fontFamily: "Inter_700Bold" },

  totalCard:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, padding: 18, borderWidth: 1 },
  totalLabel:    { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  totalBreakdown:{ fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  totalAmount:   { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },

  actionBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14 },
  actionBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
