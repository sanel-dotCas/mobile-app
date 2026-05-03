import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { CarPartsDiagram, useVinDecoder } from "@/components/CarPartsDiagram";
import type { EstimateLine, EstimateStatus, LaborCategory } from "@/context/EstimatesContext";
import { useEstimates } from "@/context/EstimatesContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const BASE_URL =
  Platform.OS === "web"
    ? ""
    : `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "localhost"}`;

const STATUS_NEXT: Partial<Record<EstimateStatus, EstimateStatus>> = {
  pending_inspection:     "inspection_in_progress",
  inspection_in_progress: "review",
  review:                 "approved",
  approved:               "submitted",
};

const STATUS_CONFIG: Record<EstimateStatus, { color: string; bg: string; label: string }> = {
  pending_inspection:     { color: "#d97706", bg: "#fef3c7", label: "Pending Inspection" },
  inspection_in_progress: { color: "#2563eb", bg: "#dbeafe", label: "In Progress" },
  review:                 { color: "#7c3aed", bg: "#ede9fe", label: "Under Review" },
  approved:               { color: "#16a34a", bg: "#dcfce7", label: "Approved" },
  submitted:              { color: "#64748b", bg: "#f1f5f9", label: "Submitted to DMS" },
};

const LABOR_CATEGORY_CONFIG: Record<LaborCategory, { label: string; color: string; bg: string; icon: string }> = {
  body:       { label: "Body",       color: "#2563eb", bg: "#eff6ff", icon: "shield" },
  refinish:   { label: "Refinish",   color: "#7c3aed", bg: "#f5f3ff", icon: "droplet" },
  mechanical: { label: "Mechanical", color: "#d97706", bg: "#fffbeb", icon: "settings" },
  frame:      { label: "Frame",      color: "#dc2626", bg: "#fef2f2", icon: "grid" },
  glass:      { label: "Glass",      color: "#0891b2", bg: "#ecfeff", icon: "eye" },
  electrical: { label: "Electrical", color: "#ca8a04", bg: "#fefce8", icon: "zap" },
  trim:       { label: "Trim",       color: "#16a34a", bg: "#f0fdf4", icon: "scissors" },
  other:      { label: "Other",      color: "#64748b", bg: "#f8fafc", icon: "more-horizontal" },
};

const ALL_LABOR_CATEGORIES: LaborCategory[] = ["body","refinish","mechanical","frame","glass","electrical","trim","other"];

interface PackageDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  lines: Omit<EstimateLine, "id">[];
}

const PACKAGES: PackageDef[] = [
  {
    id: "pkg-front-impact",
    name: "Full Front Impact",
    icon: "alert-triangle",
    color: "#dc2626",
    description: "Bonnet, bumper, headlights, radiator check",
    lines: [
      { type: "labor", laborCategory: "body",     description: "Bonnet repair / skin replacement",         hours: 4.0, unitPrice: 95, total: 380, isPackage: true, packageName: "Full Front Impact" },
      { type: "labor", laborCategory: "body",     description: "Front bumper removal & refit",             hours: 1.5, unitPrice: 95, total: 142.5, isPackage: true, packageName: "Full Front Impact" },
      { type: "labor", laborCategory: "refinish", description: "Bonnet refinish — prime, base & clear",   hours: 3.0, unitPrice: 95, total: 285, isPackage: true, packageName: "Full Front Impact" },
      { type: "labor", laborCategory: "mechanical",description: "Radiator & cooling system check",         hours: 1.0, unitPrice: 95, total: 95, isPackage: true, packageName: "Full Front Impact" },
      { type: "part",                              description: "Front bumper assembly (OEM)",              quantity: 1, unitPrice: 450, total: 450, isPackage: true, packageName: "Full Front Impact" },
      { type: "material",                          description: "Paint & refinish materials — front",       quantity: 1, unitPrice: 195, total: 195, isPackage: true, packageName: "Full Front Impact" },
    ],
  },
  {
    id: "pkg-side-swipe",
    name: "Side Swipe Repair",
    icon: "arrow-right",
    color: "#2563eb",
    description: "Door skin, quarter panel, mirror, blend",
    lines: [
      { type: "labor", laborCategory: "body",     description: "Door skin replacement",                   hours: 3.5, unitPrice: 95, total: 332.5, isPackage: true, packageName: "Side Swipe Repair" },
      { type: "labor", laborCategory: "body",     description: "Quarter panel repair / partial sectioning",hours: 2.5, unitPrice: 95, total: 237.5, isPackage: true, packageName: "Side Swipe Repair" },
      { type: "labor", laborCategory: "trim",     description: "Mirror housing replacement",              hours: 0.5, unitPrice: 95, total: 47.5, isPackage: true, packageName: "Side Swipe Repair" },
      { type: "labor", laborCategory: "refinish", description: "Door & quarter panel refinish with blend",hours: 4.0, unitPrice: 95, total: 380, isPackage: true, packageName: "Side Swipe Repair" },
      { type: "part",                              description: "Door skin panel",                          quantity: 1, unitPrice: 320, total: 320, isPackage: true, packageName: "Side Swipe Repair" },
      { type: "part",                              description: "Mirror housing assembly",                  quantity: 1, unitPrice: 185, total: 185, isPackage: true, packageName: "Side Swipe Repair" },
      { type: "material",                          description: "Paint materials — door & quarter",         quantity: 1, unitPrice: 170, total: 170, isPackage: true, packageName: "Side Swipe Repair" },
    ],
  },
  {
    id: "pkg-rear-impact",
    name: "Rear Impact Package",
    icon: "arrow-left",
    color: "#7c3aed",
    description: "Boot lid, bumper, tail lights, structural check",
    lines: [
      { type: "labor", laborCategory: "body",     description: "Boot lid removal & replacement",           hours: 2.5, unitPrice: 95, total: 237.5, isPackage: true, packageName: "Rear Impact Package" },
      { type: "labor", laborCategory: "body",     description: "Rear bumper removal & refit",              hours: 1.5, unitPrice: 95, total: 142.5, isPackage: true, packageName: "Rear Impact Package" },
      { type: "labor", laborCategory: "frame",    description: "Chassis rail inspection & minor straightening", hours: 2.0, unitPrice: 95, total: 190, isPackage: true, packageName: "Rear Impact Package" },
      { type: "labor", laborCategory: "refinish", description: "Boot lid & bumper refinish",               hours: 3.0, unitPrice: 95, total: 285, isPackage: true, packageName: "Rear Impact Package" },
      { type: "part",                              description: "Boot lid assembly (OEM)",                  quantity: 1, unitPrice: 870, total: 870, isPackage: true, packageName: "Rear Impact Package" },
      { type: "part",                              description: "Rear bumper assembly",                     quantity: 1, unitPrice: 420, total: 420, isPackage: true, packageName: "Rear Impact Package" },
      { type: "material",                          description: "Paint materials — rear section",           quantity: 1, unitPrice: 185, total: 185, isPackage: true, packageName: "Rear Impact Package" },
    ],
  },
  {
    id: "pkg-windshield",
    name: "Windshield Replacement",
    icon: "eye",
    color: "#0891b2",
    description: "Glass, adhesive, ADAS camera recalibration",
    lines: [
      { type: "labor", laborCategory: "glass",    description: "Windshield removal & replacement",        hours: 2.0, unitPrice: 95, total: 190, isPackage: true, packageName: "Windshield Replacement" },
      { type: "labor", laborCategory: "electrical",description: "ADAS forward camera recalibration",      hours: 1.0, unitPrice: 95, total: 95, isPackage: true, packageName: "Windshield Replacement" },
      { type: "part",                              description: "OEM windshield",                          quantity: 1, unitPrice: 650, total: 650, isPackage: true, packageName: "Windshield Replacement" },
      { type: "material",                          description: "Windshield adhesive kit & primer",        quantity: 1, unitPrice: 45,  total: 45, isPackage: true, packageName: "Windshield Replacement" },
    ],
  },
  {
    id: "pkg-full-repaint",
    name: "Single Panel Repaint",
    icon: "droplet",
    color: "#7c3aed",
    description: "Full prep, prime, base coat, clear coat",
    lines: [
      { type: "labor", laborCategory: "refinish", description: "Panel preparation & feather edge",        hours: 1.5, unitPrice: 95, total: 142.5, isPackage: true, packageName: "Single Panel Repaint" },
      { type: "labor", laborCategory: "refinish", description: "2K primer application & sanding",         hours: 1.0, unitPrice: 95, total: 95, isPackage: true, packageName: "Single Panel Repaint" },
      { type: "labor", laborCategory: "refinish", description: "Base coat & clear coat application",      hours: 2.0, unitPrice: 95, total: 190, isPackage: true, packageName: "Single Panel Repaint" },
      { type: "material",                          description: "2K primer, base, clear coat & hardener",  quantity: 1, unitPrice: 165, total: 165, isPackage: true, packageName: "Single Panel Repaint" },
      { type: "material",                          description: "Masking, thinners & sundries",            quantity: 1, unitPrice: 45,  total: 45, isPackage: true, packageName: "Single Panel Repaint" },
    ],
  },
  {
    id: "pkg-mechanical-safety",
    name: "Mechanical Safety Check",
    icon: "settings",
    color: "#d97706",
    description: "Brakes, fluids, steering, wheel alignment",
    lines: [
      { type: "labor", laborCategory: "mechanical", description: "Brake system inspection & pad check",   hours: 1.0, unitPrice: 95, total: 95, isPackage: true, packageName: "Mechanical Safety Check" },
      { type: "labor", laborCategory: "mechanical", description: "Steering & suspension inspection",       hours: 0.5, unitPrice: 95, total: 47.5, isPackage: true, packageName: "Mechanical Safety Check" },
      { type: "labor", laborCategory: "mechanical", description: "Four-wheel alignment check",             hours: 0.5, unitPrice: 95, total: 47.5, isPackage: true, packageName: "Mechanical Safety Check" },
      { type: "labor", laborCategory: "mechanical", description: "All fluid levels top-up",                hours: 0.5, unitPrice: 95, total: 47.5, isPackage: true, packageName: "Mechanical Safety Check" },
    ],
  },
];

function LineRow({ line, onRemove, currency }: { line: EstimateLine; onRemove: () => void; currency: string }) {
  const colors = useColors();
  const isLabor = line.type === "labor";
  const catCfg = isLabor && line.laborCategory ? LABOR_CATEGORY_CONFIG[line.laborCategory] : null;
  const tagColor = catCfg?.color ?? (line.type === "part" ? "#7c3aed" : "#d97706");
  const tagBg    = catCfg?.bg    ?? (line.type === "part" ? "#f5f3ff" : "#fffbeb");
  const tagLabel = catCfg?.label ?? (line.type === "part" ? "Parts" : "Materials");
  const tagIcon  = (catCfg?.icon ?? (line.type === "part" ? "package" : "droplet")) as any;

  return (
    <View style={[styles.lineRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.lineRowTop}>
        <View style={[styles.lineTypeTag, { backgroundColor: tagBg }]}>
          <Feather name={tagIcon} size={9} color={tagColor} />
          <Text style={[styles.lineTypeText, { color: tagColor }]}>{tagLabel}</Text>
        </View>
        {line.isPackage && (
          <View style={[styles.pkgTag, { backgroundColor: "#f0fdf4" }]}>
            <Feather name="layers" size={9} color="#16a34a" />
            <Text style={[styles.pkgTagText, { color: "#16a34a" }]}>Pkg</Text>
          </View>
        )}
        {line.aiGenerated && (
          <View style={[styles.aiTag, { backgroundColor: "#eff6ff" }]}>
            <Text style={styles.aiTagText}>✦ AI</Text>
          </View>
        )}
        <Pressable onPress={onRemove} hitSlop={10} style={styles.lineRemoveBtn}>
          <Feather name="x" size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <Text style={[styles.lineDesc, { color: colors.foreground }]} numberOfLines={2}>
        {line.description}
      </Text>
      <View style={styles.lineBottom}>
        {isLabor && line.hours !== undefined && (
          <Text style={[styles.lineMeta, { color: colors.mutedForeground }]}>
            {line.hours}h × {currency}{line.unitPrice.toFixed(2)}/h
          </Text>
        )}
        {!isLabor && line.quantity !== undefined && (
          <Text style={[styles.lineMeta, { color: colors.mutedForeground }]}>
            Qty {line.quantity} × {currency}{line.unitPrice.toFixed(2)}
          </Text>
        )}
        <Text style={[styles.lineTotal, { color: tagColor }]}>
          {currency}{line.total.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

type AddMode = "manual" | "package" | "diagram";

function AddLineSheet({
  visible,
  onClose,
  onAddManual,
  onAddPackage,
  onAddDiagram,
  vehicle,
  make,
  model,
  year,
  currency,
}: {
  visible: boolean;
  onClose: () => void;
  onAddManual: (line: Omit<EstimateLine, "id">) => void;
  onAddPackage: (pkg: PackageDef) => void;
  onAddDiagram: (line: Omit<EstimateLine, "id">) => void;
  vehicle: string;
  make: string;
  model: string;
  year: string;
  currency: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<AddMode>("manual");
  const [lineType, setLineType] = useState<"labor" | "part" | "material">("labor");
  const [laborCat, setLaborCat] = useState<LaborCategory>("body");
  const [desc, setDesc] = useState("");
  const [hours, setHours] = useState("");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);

  const resetForm = () => {
    setLineType("labor"); setLaborCat("body");
    setDesc(""); setHours(""); setQty(""); setUnitPrice("");
  };

  const handleClose = () => { resetForm(); onClose(); };

  const computedTotal = () => {
    const price = parseFloat(unitPrice) || 0;
    if (lineType === "labor") return (parseFloat(hours) || 0) * price;
    return (parseFloat(qty) || 0) * price;
  };

  const handleAddManual = () => {
    if (!desc.trim() || !unitPrice.trim()) {
      Alert.alert("Missing fields", "Please fill in description and unit price.");
      return;
    }
    const price = parseFloat(unitPrice) || 0;
    const total = computedTotal();
    const line: Omit<EstimateLine, "id"> = {
      type: lineType,
      laborCategory: lineType === "labor" ? laborCat : undefined,
      description: desc.trim(),
      hours: lineType === "labor" ? (parseFloat(hours) || 0) : undefined,
      quantity: lineType !== "labor" ? (parseFloat(qty) || 1) : undefined,
      unitPrice: price,
      total,
    };
    onAddManual(line);
    resetForm();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.sheetOverlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ width: "100%" }}
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: (Platform.OS === "web" ? 24 : insets.bottom) + 16 }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add Estimate Line</Text>
              <Pressable onPress={handleClose} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Mode tab */}
            <View style={[styles.modeTabs, { backgroundColor: colors.secondary }]}>
              {([
                { id: "manual",  icon: "edit-3", label: "Manual" },
                { id: "package", icon: "layers",  label: "Package" },
                { id: "diagram", icon: "grid",    label: "Car Parts" },
              ] as { id: AddMode; icon: string; label: string }[]).map(({ id: m, icon, label }) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.modeTab, mode === m && [styles.modeTabActive, { backgroundColor: m === "diagram" ? "#7c3aed" : colors.primary }]]}
                >
                  <Feather name={icon as any} size={13} color={mode === m ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.modeTabText, { color: mode === m ? "#fff" : colors.mutedForeground }]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === "diagram" && (
              <View style={{ height: 530 }}>
                <CarPartsDiagram
                  vehicle={vehicle}
                  make={make}
                  model={model}
                  year={year}
                  currency={currency}
                  onAddPart={(line) => { onAddDiagram(line); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
                />
              </View>
            )}
            {mode !== "diagram" && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {mode === "manual" ? (
                <View style={styles.manualForm}>
                  {/* Type selector */}
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Type</Text>
                  <View style={[styles.typeSelector, { backgroundColor: colors.secondary }]}>
                    {(["labor","part","material"] as const).map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => setLineType(t)}
                        style={[styles.typeBtn, lineType === t && [styles.typeBtnActive, {
                          backgroundColor: t === "labor" ? "#2563eb" : t === "part" ? "#7c3aed" : "#d97706",
                        }]]}
                      >
                        <Text style={[styles.typeBtnText, { color: lineType === t ? "#fff" : colors.mutedForeground }]}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Labor category */}
                  {lineType === "labor" && (
                    <>
                      <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Category</Text>
                      <View style={styles.categoryGrid}>
                        {ALL_LABOR_CATEGORIES.map((cat) => {
                          const cfg = LABOR_CATEGORY_CONFIG[cat];
                          const active = laborCat === cat;
                          return (
                            <Pressable
                              key={cat}
                              onPress={() => setLaborCat(cat)}
                              style={[styles.catBtn, { borderColor: active ? cfg.color : colors.border, backgroundColor: active ? cfg.bg : colors.secondary }]}
                            >
                              <Feather name={cfg.icon as any} size={12} color={active ? cfg.color : colors.mutedForeground} />
                              <Text style={[styles.catBtnText, { color: active ? cfg.color : colors.mutedForeground }]}>{cfg.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}

                  {/* Description */}
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Description</Text>
                  <TextInput
                    value={desc}
                    onChangeText={setDesc}
                    placeholder="e.g. Front door panel straightening"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.textInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                    multiline
                    numberOfLines={2}
                  />

                  {/* Hours / Qty + Unit Price row */}
                  <View style={styles.priceRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
                        {lineType === "labor" ? "Hours" : "Qty"}
                      </Text>
                      <TextInput
                        value={lineType === "labor" ? hours : qty}
                        onChangeText={lineType === "labor" ? setHours : setQty}
                        placeholder={lineType === "labor" ? "e.g. 2.5" : "e.g. 1"}
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                        style={[styles.textInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
                        Unit Price ({currency})
                      </Text>
                      <TextInput
                        value={unitPrice}
                        onChangeText={setUnitPrice}
                        placeholder="e.g. 95.00"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                        style={[styles.textInput, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
                      />
                    </View>
                  </View>

                  {/* Total preview */}
                  {(hours || qty) && unitPrice ? (
                    <View style={[styles.totalPreview, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                      <Text style={styles.totalPreviewLabel}>Line Total</Text>
                      <Text style={styles.totalPreviewAmount}>{currency}{computedTotal().toFixed(2)}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={handleAddManual}
                    style={({ pressed }) => [styles.addLineBtn, { backgroundColor: "#1d4ed8", opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Feather name="plus" size={15} color="#fff" />
                    <Text style={styles.addLineBtnText}>Add Line</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.packageList}>
                  {PACKAGES.map((pkg) => {
                    const expanded = expandedPkg === pkg.id;
                    const pkgLaborTotal = pkg.lines.filter(l => l.type === "labor").reduce((s, l) => s + l.total, 0);
                    const pkgPartsTotal = pkg.lines.filter(l => l.type === "part").reduce((s, l) => s + l.total, 0);
                    const pkgMatsTotal  = pkg.lines.filter(l => l.type === "material").reduce((s, l) => s + l.total, 0);
                    const pkgGrand = pkgLaborTotal + pkgPartsTotal + pkgMatsTotal;

                    return (
                      <View key={pkg.id} style={[styles.pkgCard, { borderColor: expanded ? pkg.color : colors.border, backgroundColor: colors.card }]}>
                        <Pressable
                          onPress={() => setExpandedPkg(expanded ? null : pkg.id)}
                          style={styles.pkgCardHeader}
                        >
                          <View style={[styles.pkgIcon, { backgroundColor: pkg.color + "20" }]}>
                            <Feather name={pkg.icon as any} size={16} color={pkg.color} />
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={[styles.pkgName, { color: colors.foreground }]}>{pkg.name}</Text>
                            <Text style={[styles.pkgDesc, { color: colors.mutedForeground }]}>{pkg.description}</Text>
                            <Text style={[styles.pkgTotal, { color: pkg.color }]}>
                              {pkg.lines.length} lines · {currency}{pkgGrand.toFixed(2)}
                            </Text>
                          </View>
                          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                        </Pressable>

                        {expanded && (
                          <>
                            <View style={[styles.pkgLines, { borderTopColor: colors.border }]}>
                              {pkg.lines.map((l, i) => {
                                const catCfg = l.type === "labor" && l.laborCategory ? LABOR_CATEGORY_CONFIG[l.laborCategory] : null;
                                const tagColor = catCfg?.color ?? (l.type === "part" ? "#7c3aed" : "#d97706");
                                const tagLabel = catCfg?.label ?? (l.type === "part" ? "Parts" : "Materials");
                                return (
                                  <View key={i} style={[styles.pkgLine, { borderBottomColor: colors.border }]}>
                                    <View style={[styles.pkgLineTag, { backgroundColor: (catCfg?.bg ?? (l.type === "part" ? "#f5f3ff" : "#fffbeb")) }]}>
                                      <Text style={[styles.pkgLineTagText, { color: tagColor }]}>{tagLabel}</Text>
                                    </View>
                                    <Text style={[styles.pkgLineDesc, { color: colors.foreground }]} numberOfLines={1}>{l.description}</Text>
                                    <Text style={[styles.pkgLineTotal, { color: tagColor }]}>{currency}{l.total.toFixed(2)}</Text>
                                  </View>
                                );
                              })}
                            </View>
                            <Pressable
                              onPress={() => { onAddPackage(pkg); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
                              style={({ pressed }) => [styles.addPkgBtn, { backgroundColor: pkg.color, opacity: pressed ? 0.85 : 1 }]}
                            >
                              <Feather name="layers" size={14} color="#fff" />
                              <Text style={styles.addPkgBtnText}>Add {pkg.name}</Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            )}
          </Pressable>

        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

export default function EstimateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getEstimate, updateStatus, removeLine, setLines, addLine, addPhoto } = useEstimates();
  const { t } = useLang();
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const estimate = getEstimate(id ?? "");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoBase64s, setPhotoBase64s] = useState<string[]>([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { decode: decodeVin, loading: vinLoading, error: vinError, vinInfo, clear: clearVin } = useVinDecoder();
  const [vinInput, setVinInput] = useState("");
  const [showVinInput, setShowVinInput] = useState(false);

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
  const currency = "$";

  const laborLines    = estimate.lines.filter((l) => l.type === "labor");
  const partLines     = estimate.lines.filter((l) => l.type === "part");
  const materialLines = estimate.lines.filter((l) => l.type === "material");
  const laborTotal    = laborLines.reduce((s, l) => s + l.total, 0);
  const partsTotal    = partLines.reduce((s, l) => s + l.total, 0);
  const materialsTotal= materialLines.reduce((s, l) => s + l.total, 0);
  const grandTotal    = laborTotal + partsTotal + materialsTotal;

  // Group labor lines by category
  const laborByCategory = ALL_LABOR_CATEGORIES.reduce<Record<LaborCategory, EstimateLine[]>>(
    (acc, cat) => {
      acc[cat] = laborLines.filter((l) => (l.laborCategory ?? "other") === cat);
      return acc;
    },
    {} as Record<LaborCategory, EstimateLine[]>
  );
  const activeLaborCategories = ALL_LABOR_CATEGORIES.filter((cat) => laborByCategory[cat].length > 0);

  const canAnalyse  = estimate.status !== "submitted" && estimate.status !== "approved";
  const canSubmit   = estimate.status === "review" || estimate.status === "inspection_in_progress";
  const canApprove  = estimate.status === "review" || (estimate.lines.length > 0 && estimate.status === "inspection_in_progress");

  const applyAsset = useCallback((uri: string, base64: string | null) => {
    setPhotoUris((prev) => [...prev, uri]);
    setPhotoBase64s((prev) => [...prev, base64 ?? ""]);
    setAnalysisError(null);
    if (estimate.status === "pending_inspection") updateStatus(estimate.id, "inspection_in_progress");
    addPhoto(estimate.id, { uri, capturedAt: new Date().toISOString() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [estimate, updateStatus, addPhoto]);

  const removePhoto = useCallback((index: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
    setPhotoBase64s((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleWebFilePick = useCallback(() => {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) return;
      files.forEach((file) => {
        const objectUrl = URL.createObjectURL(file);
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
          applyAsset(objectUrl, base64);
        };
        reader.onerror = () => setAnalysisError("Could not read the selected file.");
        reader.readAsDataURL(file);
      });
    };
    input.click();
  }, [applyAsset]);

  const handlePickPhoto = useCallback(async () => {
    if (Platform.OS === "web") { handleWebFilePick(); return; }
    try {
      const camStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus.status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is needed.");
        return;
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
        applyAsset(asset.uri, asset.base64 ?? null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not open camera.";
      setAnalysisError(msg);
    }
  }, [handleWebFilePick, applyAsset]);

  const handlePickFromLibrary = useCallback(async () => {
    if (Platform.OS === "web") { handleWebFilePick(); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.75,
        base64: true,
        allowsMultipleSelection: true,
      });
      if (!result.canceled) {
        result.assets.forEach((asset) => applyAsset(asset.uri, asset.base64 ?? null));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not open photo library.";
      setAnalysisError(msg);
    }
  }, [handleWebFilePick, applyAsset]);

  const handleAnalyse = useCallback(async () => {
    setIsAnalysing(true);
    setAnalysisError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const apiBase = BASE_URL || "http://localhost:80";
      const validBase64s = photoBase64s.filter(Boolean);
      const response = await fetch(`${apiBase}/api/estimates/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleInfo: `${estimate.year} ${estimate.make} ${estimate.model} (${estimate.odometer})`,
          damageNotes: estimate.damageNotes,
          imagesBase64: validBase64s.length > 0 ? validBase64s : undefined,
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
  }, [estimate, photoBase64s, setLines, updateStatus]);

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

  const handleAddManual = useCallback((line: Omit<EstimateLine, "id">) => {
    addLine(estimate.id, line);
    setShowAddModal(false);
  }, [estimate.id, addLine]);

  const handleAddDiagram = useCallback((line: Omit<EstimateLine, "id">) => {
    addLine(estimate.id, line);
    // intentionally keep modal open so user can add multiple parts
  }, [estimate.id, addLine]);

  const handleAddPackage = useCallback((pkg: PackageDef) => {
    pkg.lines.forEach((l) => addLine(estimate.id, l));
    setShowAddModal(false);
    if (estimate.status === "pending_inspection") updateStatus(estimate.id, "inspection_in_progress");
  }, [estimate.id, addLine, estimate.status, updateStatus]);

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
          <View style={styles.sectionHeader}>
            <Feather name="truck" size={14} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.vehicle}</Text>
          </View>
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

          {/* VIN Decoder */}
          <View style={[styles.vinSection, { borderTopColor: colors.border }]}>
            {!showVinInput && !vinInfo && (
              <Pressable
                onPress={() => setShowVinInput(true)}
                style={[styles.vinTrigger, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}
              >
                <Feather name="search" size={13} color="#1d4ed8" />
                <Text style={styles.vinTriggerText}>VIN Lookup — link parts to this vehicle</Text>
                <Feather name="chevron-right" size={13} color="#93c5fd" />
              </Pressable>
            )}

            {showVinInput && (
              <View style={styles.vinInputRow}>
                <TextInput
                  value={vinInput}
                  onChangeText={(t) => setVinInput(t.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ""))}
                  placeholder="Enter 17-char VIN (e.g. 1HGCM82633A004352)"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={17}
                  autoCapitalize="characters"
                  style={[styles.vinInput, { backgroundColor: colors.secondary, borderColor: vinError ? "#dc2626" : colors.border, color: colors.foreground }]}
                />
                <Pressable
                  onPress={() => decodeVin(vinInput)}
                  disabled={vinLoading}
                  style={[styles.vinDecodeBtn, { backgroundColor: vinLoading ? "#94a3b8" : "#1d4ed8" }]}
                >
                  {vinLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Feather name="search" size={14} color="#fff" />}
                </Pressable>
                <Pressable
                  onPress={() => { setShowVinInput(false); setVinInput(""); clearVin(); }}
                  style={styles.vinCancelBtn}
                  hitSlop={8}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}

            {vinError && (
              <Text style={styles.vinError}>{vinError}</Text>
            )}

            {vinInfo && (
              <View style={[styles.vinResult, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                <View style={styles.vinResultHeader}>
                  <Feather name="check-circle" size={13} color="#1d4ed8" />
                  <Text style={styles.vinResultTitle}>
                    VIN Decoded — {vinInfo.year} {vinInfo.make} {vinInfo.model}
                    {vinInfo.trim ? ` · ${vinInfo.trim}` : ""}
                  </Text>
                  <Pressable onPress={() => { clearVin(); setShowVinInput(false); }} hitSlop={8}>
                    <Feather name="x" size={13} color="#93c5fd" />
                  </Pressable>
                </View>
                <View style={styles.vinResultGrid}>
                  {[
                    { label: "Body",   value: vinInfo.bodyClass || "—" },
                    { label: "Fuel",   value: vinInfo.fuelType || "—" },
                    { label: "Engine", value: vinInfo.engineSize || "—" },
                    { label: "Drive",  value: vinInfo.driveType || "—" },
                  ].map(({ label, value }) => (
                    <View key={label} style={styles.vehicleCell}>
                      <Text style={[styles.vehicleCellLabel, { color: "#93c5fd" }]}>{label}</Text>
                      <Text style={[styles.vehicleCellValue, { color: "#1e40af" }]}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
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

        {/* AI photo capture */}
        {canAnalyse && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="camera" size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t.aiDamageAnalysis}</Text>
              <View style={styles.aiPoweredBadge}>
                <Text style={styles.aiPoweredText}>✦ AI</Text>
              </View>
            </View>

            {photoUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailStrip} contentContainerStyle={styles.thumbnailStripContent}>
                {photoUris.map((uri, index) => (
                  <View key={index} style={styles.thumbnailWrapper}>
                    <Image source={{ uri }} style={styles.thumbnail} contentFit="cover" />
                    <Pressable
                      onPress={() => removePhoto(index)}
                      style={[styles.thumbnailRemoveBtn, { backgroundColor: "rgba(0,0,0,0.6)" }]}
                    >
                      <Feather name="x" size={10} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            {Platform.OS === "web" ? (
              <Pressable
                onPress={handleWebFilePick}
                style={({ pressed }) => [styles.photoBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name="upload" size={16} color="#fff" />
                <Text style={styles.photoBtnText}>{photoUris.length > 0 ? "Add More Photos" : "Upload Photos"}</Text>
              </Pressable>
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
              disabled={isAnalysing || photoBase64s.filter(Boolean).length === 0}
              style={({ pressed }) => [
                styles.analyseBtn,
                { backgroundColor: (isAnalysing || photoBase64s.filter(Boolean).length === 0) ? "#94a3b8" : "#1d4ed8", opacity: pressed ? 0.85 : 1 },
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

        {/* ── LABOUR — grouped by category ── */}
        {activeLaborCategories.length > 0 && (
          <View style={styles.linesSection}>
            <View style={styles.linesSectionHeader}>
              <View style={[styles.linesTypeTag, { backgroundColor: "#eff6ff" }]}>
                <Feather name="tool" size={11} color="#2563eb" />
                <Text style={[styles.linesSectionTitle, { color: "#2563eb" }]}>{t.laborLines}</Text>
              </View>
              <Text style={[styles.linesSectionTotal, { color: "#2563eb" }]}>{currency}{laborTotal.toFixed(2)}</Text>
            </View>
            {activeLaborCategories.map((cat) => {
              const catCfg = LABOR_CATEGORY_CONFIG[cat];
              const catLines = laborByCategory[cat];
              const catTotal = catLines.reduce((s, l) => s + l.total, 0);
              return (
                <View key={cat} style={styles.catGroup}>
                  <View style={[styles.catGroupHeader, { borderLeftColor: catCfg.color, backgroundColor: catCfg.bg }]}>
                    <Feather name={catCfg.icon as any} size={11} color={catCfg.color} />
                    <Text style={[styles.catGroupTitle, { color: catCfg.color }]}>{catCfg.label}</Text>
                    <Text style={[styles.catGroupTotal, { color: catCfg.color }]}>{currency}{catTotal.toFixed(2)}</Text>
                  </View>
                  {catLines.map((l) => (
                    <LineRow key={l.id} line={l} currency={currency} onRemove={() => removeLine(estimate.id, l.id)} />
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* Parts */}
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
              <LineRow key={l.id} line={l} currency={currency} onRemove={() => removeLine(estimate.id, l.id)} />
            ))}
          </View>
        )}

        {/* Materials */}
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
              <LineRow key={l.id} line={l} currency={currency} onRemove={() => removeLine(estimate.id, l.id)} />
            ))}
          </View>
        )}

        {/* Add Line button */}
        {estimate.status !== "submitted" && (
          <Pressable
            onPress={() => setShowAddModal(true)}
            style={({ pressed }) => [styles.addLineRow, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={[styles.addLineIconWrap, { backgroundColor: "#eff6ff" }]}>
              <Feather name="plus" size={14} color="#2563eb" />
            </View>
            <Text style={[styles.addLineRowText, { color: "#2563eb" }]}>Add Line — Manual or Package</Text>
            <Feather name="chevron-right" size={14} color="#2563eb" />
          </Pressable>
        )}

        {/* Grand total */}
        {grandTotal > 0 && (
          <View style={[styles.totalCard, { backgroundColor: "#1d4ed8" }]}>
            <View style={{ gap: 4 }}>
              <Text style={styles.totalLabel}>{t.estimateTotal}</Text>
              <Text style={styles.totalBreakdown}>
                Labour {currency}{laborTotal.toFixed(2)}{"  "}·{"  "}Parts {currency}{partsTotal.toFixed(2)}{"  "}·{"  "}Materials {currency}{materialsTotal.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.totalAmount}>{currency}{grandTotal.toFixed(2)}</Text>
          </View>
        )}

        {/* Actions */}
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

      <AddLineSheet
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddManual={handleAddManual}
        onAddPackage={handleAddPackage}
        onAddDiagram={handleAddDiagram}
        vehicle={estimate.vehicle}
        make={estimate.make}
        model={estimate.model}
        year={estimate.year}
        currency={currency}
      />
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

  thumbnailStrip:        { marginBottom: 4 },
  thumbnailStripContent: { gap: 8, paddingVertical: 4 },
  thumbnailWrapper:      { width: 80, height: 80, borderRadius: 8, overflow: "hidden", position: "relative" },
  thumbnail:             { width: 80, height: 80 },
  thumbnailRemoveBtn:    { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },

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

  linesSection:       { gap: 8 },
  linesSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  linesTypeTag:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  linesSectionTitle:  { fontSize: 12, fontFamily: "Inter_700Bold" },
  linesSectionTotal:  { fontSize: 14, fontFamily: "Inter_700Bold" },

  catGroup:       { gap: 6 },
  catGroupHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderLeftWidth: 3 },
  catGroupTitle:  { flex: 1, fontSize: 11, fontFamily: "Inter_700Bold" },
  catGroupTotal:  { fontSize: 11, fontFamily: "Inter_700Bold" },

  lineRow:        { borderRadius: 10, borderWidth: 1, padding: 10, gap: 5 },
  lineRowTop:     { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  lineTypeTag:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  lineTypeText:   { fontSize: 9, fontFamily: "Inter_700Bold" },
  pkgTag:         { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6 },
  pkgTagText:     { fontSize: 9, fontFamily: "Inter_700Bold" },
  aiTag:          { paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6 },
  aiTagText:      { fontSize: 9, fontFamily: "Inter_700Bold", color: "#2563eb" },
  lineRemoveBtn:  { marginLeft: "auto" },
  lineDesc:       { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 17 },
  lineBottom:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lineMeta:       { fontSize: 11, fontFamily: "Inter_400Regular" },
  lineTotal:      { fontSize: 13, fontFamily: "Inter_700Bold" },

  addLineRow:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed" },
  addLineIconWrap:{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  addLineRowText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },

  totalCard:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, padding: 18 },
  totalLabel:    { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  totalBreakdown:{ fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  totalAmount:   { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },

  actionBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14 },
  actionBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  sheetOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:         { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 },
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle:    { fontSize: 17, fontFamily: "Inter_700Bold" },

  modeTabs:      { flexDirection: "row", borderRadius: 12, padding: 3, gap: 3 },
  modeTab:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10 },
  modeTabActive: {},
  modeTabText:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  manualForm:    { gap: 10, paddingBottom: 8 },
  formLabel:     { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: -4 },
  typeSelector:  { flexDirection: "row", borderRadius: 10, padding: 3, gap: 3 },
  typeBtn:       { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  typeBtnActive: {},
  typeBtnText:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  categoryGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catBtn:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5 },
  catBtnText:    { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  textInput:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular" },
  priceRow:      { flexDirection: "row", gap: 10 },

  totalPreview:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderRadius: 10, borderWidth: 1 },
  totalPreviewLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1d4ed8" },
  totalPreviewAmount:{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#1d4ed8" },

  addLineBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  addLineBtnText:{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  packageList:   { gap: 10, paddingBottom: 8 },
  pkgCard:       { borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  pkgCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  pkgIcon:       { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  pkgName:       { fontSize: 14, fontFamily: "Inter_700Bold" },
  pkgDesc:       { fontSize: 11, fontFamily: "Inter_400Regular" },
  pkgTotal:      { fontSize: 11, fontFamily: "Inter_700Bold" },

  pkgLines:      { borderTopWidth: 1, gap: 0 },
  pkgLine:       { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  pkgLineTag:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  pkgLineTagText:{ fontSize: 9, fontFamily: "Inter_700Bold" },
  pkgLineDesc:   { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  pkgLineTotal:  { fontSize: 12, fontFamily: "Inter_700Bold" },

  addPkgBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 12, paddingVertical: 11, borderRadius: 10 },
  addPkgBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  vinSection:      { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  vinTrigger:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  vinTriggerText:  { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1d4ed8" },
  vinInputRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  vinInput:        { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  vinDecodeBtn:    { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  vinCancelBtn:    { padding: 4 },
  vinError:        { fontSize: 11, fontFamily: "Inter_400Regular", color: "#dc2626", paddingHorizontal: 2 },
  vinResult:       { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  vinResultHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  vinResultTitle:  { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1d4ed8" },
  vinResultGrid:   { flexDirection: "row", flexWrap: "wrap" },
});
