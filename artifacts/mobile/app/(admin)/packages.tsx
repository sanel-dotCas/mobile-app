import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActionSheetIOS,
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
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PackageLine {
  id: number;
  lineType: "labor" | "part" | "material";
  laborCategory: string | null;
  description: string;
  hours: string | null;
  quantity: string | null;
  unitPrice: string;
  displayOrder: number;
}

interface ServicePackage {
  id: number;
  name: string;
  icon: string;
  color: string;
  description: string;
  isActive: boolean;
  vehicleModel: string | null;
  serviceInterval: string | null;
  bundleCode: string | null;
  lines: PackageLine[];
}

interface Deployment {
  id: number;
  packageId: number;
  locationId: number;
  locationName: string | null;
  packageName: string | null;
  deployedAt: string;
  deployedBy: string | null;
}

interface Location {
  id: number;
  name: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const LINE_TYPE_COLOR = {
  labor: { bg: "#dbeafe", text: "#1d4ed8", label: "Labour" },
  part: { bg: "#dcfce7", text: "#16a34a", label: "Part" },
  material: { bg: "#fef3c7", text: "#d97706", label: "Material" },
};

function formatPrice(val: string | number | null | undefined) {
  const n = Number(val);
  if (isNaN(n)) return "—";
  return `R${n.toFixed(2)}`;
}

function lineTotal(line: PackageLine): number {
  const price = parseFloat(line.unitPrice) || 0;
  if (line.lineType === "labor") return (parseFloat(line.hours ?? "0") || 0) * price;
  return (parseFloat(line.quantity ?? "1") || 1) * price;
}

function packageTotal(lines: PackageLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LineBadge({ type }: { type: "labor" | "part" | "material" }) {
  const c = LINE_TYPE_COLOR[type];
  return (
    <View style={[styles.lineBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.lineBadgeText, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

interface DeployToggleProps {
  location: Location;
  deployment: Deployment | undefined;
  packageId: number;
  onDeploy: (locationId: number) => void;
  onUndeploy: (deploymentId: number) => void;
}

function DeployToggle({ location, deployment, packageId, onDeploy, onUndeploy }: DeployToggleProps) {
  const colors = useColors();
  const isDeployed = !!deployment;
  return (
    <Pressable
      style={[
        styles.deployRow,
        { borderBottomColor: colors.border },
      ]}
      onPress={() =>
        isDeployed ? onUndeploy(deployment!.id) : onDeploy(location.id)
      }
    >
      <View style={styles.deployRowLeft}>
        <View style={[styles.deployDot, { backgroundColor: isDeployed ? "#16a34a" : "#cbd5e1" }]} />
        <Text style={[styles.deployLocationName, { color: colors.foreground }]}>{location.name}</Text>
      </View>
      <View style={[styles.deployChip, { backgroundColor: isDeployed ? "#dcfce7" : "#f1f5f9" }]}>
        <Feather name={isDeployed ? "check" : "plus"} size={12} color={isDeployed ? "#16a34a" : "#64748b"} />
        <Text style={[styles.deployChipText, { color: isDeployed ? "#16a34a" : "#64748b" }]}>
          {isDeployed ? "Deployed" : "Deploy"}
        </Text>
      </View>
    </Pressable>
  );
}

interface PackageCardProps {
  pkg: ServicePackage;
  deployments: Deployment[];
  locations: Location[];
  onDeploy: (packageId: number, locationId: number) => void;
  onUndeploy: (deploymentId: number) => void;
  onDelete: (pkg: ServicePackage) => void;
  onEdit: (pkg: ServicePackage) => void;
}

function PackageCard({ pkg, deployments, locations, onDeploy, onUndeploy, onDelete, onEdit }: PackageCardProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const pkgDeployments = deployments.filter((d) => d.packageId === pkg.id);
  const deployedCount = pkgDeployments.length;
  const total = packageTotal(pkg.lines);

  const laborLines = pkg.lines.filter((l) => l.lineType === "labor");
  const partLines = pkg.lines.filter((l) => l.lineType === "part");
  const materialLines = pkg.lines.filter((l) => l.lineType === "material");

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Colored left accent */}
      <View style={[styles.cardAccent, { backgroundColor: pkg.color }]} />

      <Pressable style={styles.cardMain} onPress={() => setExpanded((e) => !e)}>
        {/* Header row */}
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconCircle, { backgroundColor: pkg.color + "22" }]}>
            <Feather name={(pkg.icon as React.ComponentProps<typeof Feather>["name"]) ?? "package"} size={18} color={pkg.color} />
          </View>
          <View style={styles.cardTitle}>
            <Text style={[styles.pkgName, { color: colors.foreground }]} numberOfLines={1}>{pkg.name}</Text>
            {(pkg.vehicleModel || pkg.serviceInterval) && (
              <Text style={[styles.pkgSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {[pkg.vehicleModel, pkg.serviceInterval].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </View>

        {/* Description */}
        {pkg.description ? (
          <Text style={[styles.pkgDescription, { color: colors.mutedForeground }]} numberOfLines={expanded ? undefined : 2}>
            {pkg.description}
          </Text>
        ) : null}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Feather name="list" size={11} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>{pkg.lines.length} lines</Text>
          </View>
          <View style={styles.statChip}>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>
              {deployedCount}/{locations.length} branches
            </Text>
          </View>
          <Text style={[styles.totalText, { color: pkg.color }]}>
            {formatPrice(total)}
          </Text>
        </View>
      </Pressable>

      {/* Expanded content */}
      {expanded && (
        <View style={[styles.expandedBody, { borderTopColor: colors.border }]}>
          {/* Lines */}
          {pkg.lines.length > 0 && (
            <View style={styles.expandSection}>
              <Text style={[styles.expandSectionTitle, { color: colors.mutedForeground }]}>
                LINE ITEMS ({pkg.lines.length})
              </Text>

              {[{ label: "Labour", items: laborLines }, { label: "Parts", items: partLines }, { label: "Materials", items: materialLines }]
                .filter((g) => g.items.length > 0)
                .map((group) => (
                  <View key={group.label} style={styles.lineGroup}>
                    <Text style={[styles.lineGroupTitle, { color: colors.mutedForeground }]}>{group.label}</Text>
                    {group.items.map((line) => (
                      <View key={line.id} style={[styles.lineRow, { borderBottomColor: colors.border }]}>
                        <View style={styles.lineRowLeft}>
                          <LineBadge type={line.lineType} />
                          <Text style={[styles.lineDesc, { color: colors.foreground }]} numberOfLines={2}>
                            {line.description}
                          </Text>
                        </View>
                        <View style={styles.lineRowRight}>
                          <Text style={[styles.lineDetail, { color: colors.mutedForeground }]}>
                            {line.lineType === "labor"
                              ? `${line.hours}h @ ${formatPrice(line.unitPrice)}`
                              : `x${line.quantity} @ ${formatPrice(line.unitPrice)}`}
                          </Text>
                          <Text style={[styles.lineTotal, { color: colors.foreground }]}>
                            {formatPrice(lineTotal(line))}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}

              {/* Total */}
              <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.totalLabel, { color: colors.foreground }]}>Package Total</Text>
                <Text style={[styles.totalValue, { color: pkg.color }]}>{formatPrice(total)}</Text>
              </View>
            </View>
          )}

          {/* Branch deployments */}
          {locations.length > 0 && (
            <View style={[styles.expandSection, { marginTop: 12 }]}>
              <Text style={[styles.expandSectionTitle, { color: colors.mutedForeground }]}>
                BRANCH DEPLOYMENT
              </Text>
              {locations.map((loc) => {
                const dep = pkgDeployments.find((d) => d.locationId === loc.id);
                return (
                  <DeployToggle
                    key={loc.id}
                    location={loc}
                    deployment={dep}
                    packageId={pkg.id}
                    onDeploy={(locationId) => onDeploy(pkg.id, locationId)}
                    onUndeploy={onUndeploy}
                  />
                );
              })}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.cardActions}>
            <Pressable
              style={styles.editBtn}
              onPress={() => onEdit(pkg)}
            >
              <Feather name="edit-2" size={13} color="#1d4ed8" />
              <Text style={styles.editBtnText}>Edit Package</Text>
            </Pressable>
            <Pressable
              style={styles.deleteBtn}
              onPress={() => onDelete(pkg)}
            >
              <Feather name="trash-2" size={13} color="#dc2626" />
              <Text style={styles.deleteBtnText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Import result modal ────────────────────────────────────────────────────────

interface ImportResultModalProps {
  visible: boolean;
  result: { imported: number; updated: number; errors: string[] } | null;
  onClose: () => void;
}

function ImportResultModal({ visible, result, onClose }: ImportResultModalProps) {
  const colors = useColors();
  if (!result) return null;
  const hasErrors = result.errors.length > 0;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Feather
              name={hasErrors && result.imported === 0 ? "x-circle" : "check-circle"}
              size={28}
              color={hasErrors && result.imported === 0 ? "#dc2626" : "#16a34a"}
            />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Import {hasErrors && result.imported === 0 ? "Failed" : "Complete"}
            </Text>
          </View>
          <View style={styles.modalStats}>
            <View style={[styles.modalStat, { backgroundColor: "#dcfce7" }]}>
              <Text style={[styles.modalStatNum, { color: "#16a34a" }]}>{result.imported}</Text>
              <Text style={[styles.modalStatLabel, { color: "#16a34a" }]}>Imported</Text>
            </View>
            <View style={[styles.modalStat, { backgroundColor: "#dbeafe" }]}>
              <Text style={[styles.modalStatNum, { color: "#1d4ed8" }]}>{result.updated}</Text>
              <Text style={[styles.modalStatLabel, { color: "#1d4ed8" }]}>Updated</Text>
            </View>
            {hasErrors && (
              <View style={[styles.modalStat, { backgroundColor: "#fef2f2" }]}>
                <Text style={[styles.modalStatNum, { color: "#dc2626" }]}>{result.errors.length}</Text>
                <Text style={[styles.modalStatLabel, { color: "#dc2626" }]}>Errors</Text>
              </View>
            )}
          </View>
          {hasErrors && (
            <ScrollView style={styles.errorList}>
              {result.errors.map((e, i) => (
                <View key={i} style={[styles.errorRow, { borderBottomColor: colors.border }]}>
                  <Feather name="alert-circle" size={12} color="#dc2626" />
                  <Text style={[styles.errorText, { color: "#dc2626" }]}>{e}</Text>
                </View>
              ))}
            </ScrollView>
          )}
          <Pressable style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Edit package modal ─────────────────────────────────────────────────────────

interface EditLine {
  id?: number;
  lineType: "labor" | "part" | "material";
  laborCategory: string;
  description: string;
  hours: string;
  quantity: string;
  unitPrice: string;
  displayOrder: number;
}

interface EditPackageModalProps {
  visible: boolean;
  pkg: ServicePackage | null;
  onClose: () => void;
  onSaved: (updated: ServicePackage) => void;
}

function EditPackageModal({ visible, pkg, onClose, onSaved }: EditPackageModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [serviceInterval, setServiceInterval] = useState("");
  const [bundleCode, setBundleCode] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#1d4ed8");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pkg) {
      setName(pkg.name);
      setVehicleModel(pkg.vehicleModel ?? "");
      setServiceInterval(pkg.serviceInterval ?? "");
      setBundleCode(pkg.bundleCode ?? "");
      setDescription(pkg.description ?? "");
      setColor(pkg.color ?? "#1d4ed8");
      setLines(
        pkg.lines.map((l) => ({
          id: l.id,
          lineType: l.lineType,
          laborCategory: l.laborCategory ?? "",
          description: l.description,
          hours: l.hours ?? "",
          quantity: l.quantity ?? "1",
          unitPrice: l.unitPrice ?? "0",
          displayOrder: l.displayOrder,
        }))
      );
    }
  }, [pkg]);

  const updateLine = (idx: number, field: keyof EditLine, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { lineType: "part", laborCategory: "", description: "", hours: "", quantity: "1", unitPrice: "0", displayOrder: prev.length + 1 },
    ]);
  };

  const lineTotal = (l: EditLine) => {
    const price = parseFloat(l.unitPrice) || 0;
    if (l.lineType === "labor") return (parseFloat(l.hours) || 0) * price;
    return (parseFloat(l.quantity) || 1) * price;
  };

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const handleSave = async () => {
    if (!pkg) return;
    if (!name.trim()) { Alert.alert("Validation", "Package name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/service-packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          vehicleModel: vehicleModel.trim() || null,
          serviceInterval: serviceInterval.trim() || null,
          bundleCode: bundleCode.trim() || null,
          description: description.trim(),
          color,
          lines: lines.map((l, idx) => ({
            lineType: l.lineType,
            laborCategory: l.laborCategory || null,
            description: l.description,
            hours: l.lineType === "labor" ? l.hours || null : null,
            quantity: l.lineType !== "labor" ? l.quantity || "1" : null,
            unitPrice: l.unitPrice || "0",
            displayOrder: idx + 1,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", (err as { error?: string }).error ?? "Could not save changes");
        return;
      }
      const updated = await res.json();
      onSaved(updated);
      onClose();
    } catch {
      Alert.alert("Error", "Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#64748b"];
  const LINE_TYPES: EditLine["lineType"][] = ["part", "labor", "material"];
  const LINE_TYPE_LABELS = { part: "Part", labor: "Labour", material: "Material" };

  if (!pkg) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[editStyles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[editStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
            <Pressable onPress={onClose} style={editStyles.headerBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={[editStyles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              Edit Package
            </Text>
            <Pressable onPress={handleSave} style={[editStyles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={editStyles.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[editStyles.scroll, { paddingBottom: insets.bottom + 24 }]}>
            {/* Package Info */}
            <Text style={[editStyles.sectionLabel, { color: colors.mutedForeground }]}>PACKAGE INFO</Text>
            <View style={[editStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={editStyles.fieldRow}>
                <Text style={[editStyles.fieldLabel, { color: colors.mutedForeground }]}>Name *</Text>
                <TextInput
                  style={[editStyles.fieldInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. DT-5.7L 1.6yr Service"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={editStyles.fieldRow}>
                <Text style={[editStyles.fieldLabel, { color: colors.mutedForeground }]}>Vehicle Model</Text>
                <TextInput
                  style={[editStyles.fieldInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  placeholder="e.g. DT-5.7L-REBEL"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={editStyles.fieldRow}>
                <Text style={[editStyles.fieldLabel, { color: colors.mutedForeground }]}>Service Interval</Text>
                <TextInput
                  style={[editStyles.fieldInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                  value={serviceInterval}
                  onChangeText={setServiceInterval}
                  placeholder="e.g. 1.6yr"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={editStyles.fieldRow}>
                <Text style={[editStyles.fieldLabel, { color: colors.mutedForeground }]}>Bundle Code</Text>
                <TextInput
                  style={[editStyles.fieldInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                  value={bundleCode}
                  onChangeText={setBundleCode}
                  placeholder="e.g. RPPDTLBA4"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={[editStyles.fieldRow, { borderBottomWidth: 0 }]}>
                <Text style={[editStyles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
                <TextInput
                  style={[editStyles.fieldInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Short description…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
              </View>
            </View>

            {/* Color */}
            <Text style={[editStyles.sectionLabel, { color: colors.mutedForeground }]}>ACCENT COLOUR</Text>
            <View style={[editStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={editStyles.colorRow}>
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[editStyles.colorSwatch, { backgroundColor: c }, color === c && editStyles.colorSwatchActive]}
                    onPress={() => setColor(c)}
                  >
                    {color === c && <Feather name="check" size={14} color="#fff" />}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Line Items */}
            <View style={editStyles.lineHeader}>
              <Text style={[editStyles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                LINE ITEMS ({lines.length})
              </Text>
              <Pressable style={editStyles.addLineBtn} onPress={addLine}>
                <Feather name="plus" size={14} color="#1d4ed8" />
                <Text style={editStyles.addLineBtnText}>Add Line</Text>
              </Pressable>
            </View>

            {lines.map((line, idx) => {
              const c = LINE_TYPE_COLOR[line.lineType];
              return (
                <View key={idx} style={[editStyles.lineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {/* Type selector */}
                  <View style={editStyles.typeRow}>
                    {LINE_TYPES.map((t) => (
                      <Pressable
                        key={t}
                        style={[editStyles.typeChip, line.lineType === t && { backgroundColor: LINE_TYPE_COLOR[t].bg }]}
                        onPress={() => updateLine(idx, "lineType", t)}
                      >
                        <Text style={[editStyles.typeChipText, { color: line.lineType === t ? LINE_TYPE_COLOR[t].text : colors.mutedForeground }]}>
                          {LINE_TYPE_LABELS[t]}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable onPress={() => removeLine(idx)} style={editStyles.removeLineBtn}>
                      <Feather name="trash-2" size={13} color="#dc2626" />
                    </Pressable>
                  </View>

                  {/* Description */}
                  <TextInput
                    style={[editStyles.lineInput, { color: colors.foreground, borderColor: colors.border }]}
                    value={line.description}
                    onChangeText={(v) => updateLine(idx, "description", v)}
                    placeholder="Description…"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                  />

                  {/* Qty / Hours + Price row */}
                  <View style={editStyles.lineNumRow}>
                    {line.lineType === "labor" ? (
                      <View style={editStyles.lineNumField}>
                        <Text style={[editStyles.lineNumLabel, { color: colors.mutedForeground }]}>Hours</Text>
                        <TextInput
                          style={[editStyles.lineNumInput, { color: colors.foreground, borderColor: colors.border }]}
                          value={line.hours}
                          onChangeText={(v) => updateLine(idx, "hours", v)}
                          keyboardType="decimal-pad"
                          placeholder="0.0"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </View>
                    ) : (
                      <View style={editStyles.lineNumField}>
                        <Text style={[editStyles.lineNumLabel, { color: colors.mutedForeground }]}>Qty</Text>
                        <TextInput
                          style={[editStyles.lineNumInput, { color: colors.foreground, borderColor: colors.border }]}
                          value={line.quantity}
                          onChangeText={(v) => updateLine(idx, "quantity", v)}
                          keyboardType="decimal-pad"
                          placeholder="1"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </View>
                    )}
                    <View style={editStyles.lineNumField}>
                      <Text style={[editStyles.lineNumLabel, { color: colors.mutedForeground }]}>Unit Price (R)</Text>
                      <TextInput
                        style={[editStyles.lineNumInput, { color: colors.foreground, borderColor: colors.border }]}
                        value={line.unitPrice}
                        onChangeText={(v) => updateLine(idx, "unitPrice", v)}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                    <View style={editStyles.lineTotalField}>
                      <Text style={[editStyles.lineNumLabel, { color: colors.mutedForeground }]}>Total</Text>
                      <Text style={[editStyles.lineTotalVal, { color: c.text }]}>
                        R{lineTotal(line).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {lines.length === 0 && (
              <Pressable style={[editStyles.emptyLines, { borderColor: colors.border }]} onPress={addLine}>
                <Feather name="plus-circle" size={22} color="#1d4ed8" />
                <Text style={[editStyles.emptyLinesText, { color: colors.mutedForeground }]}>Tap to add line items</Text>
              </Pressable>
            )}

            {/* Grand Total */}
            {lines.length > 0 && (
              <View style={[editStyles.grandTotal, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[editStyles.grandTotalLabel, { color: colors.foreground }]}>Package Total</Text>
                <Text style={[editStyles.grandTotalValue, { color: color }]}>R{grandTotal.toFixed(2)}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
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
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 70,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  scroll: { padding: 16, gap: 12 },

  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 8,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  fieldRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  fieldInput: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 2,
  },

  colorRow: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    flexWrap: "wrap",
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchActive: {
    transform: [{ scale: 1.15 }],
  },

  lineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 6,
  },
  addLineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#dbeafe",
    borderRadius: 8,
  },
  addLineBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1d4ed8" },

  lineCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  typeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  typeChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  removeLineBtn: { marginLeft: "auto" as const, padding: 4 },

  lineInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    minHeight: 38,
  },

  lineNumRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  lineNumField: { flex: 1, gap: 4 },
  lineNumLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  lineNumInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  lineTotalField: { flex: 1, gap: 4, alignItems: "flex-end" },
  lineTotalVal: { fontSize: 15, fontFamily: "Inter_700Bold", paddingBottom: 6 },

  emptyLines: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  emptyLinesText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  grandTotalValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function AdminPackagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 84 : insets.bottom + 80;

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);
  const [editingPkg, setEditingPkg] = useState<ServicePackage | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [pkgsRes, depRes, locRes] = await Promise.all([
        fetch(`${BASE}/service-packages`),
        fetch(`${BASE}/service-packages/deployments`),
        fetch(`${BASE}/admin/locations`),
      ]);
      const [pkgsData, depData, locData] = await Promise.all([
        pkgsRes.ok ? pkgsRes.json() : { packages: [] },
        depRes.ok ? depRes.json() : { deployments: [] },
        locRes.ok ? locRes.json() : [],
      ]);
      setPackages(pkgsData.packages ?? []);
      setDeployments(depData.deployments ?? []);
      // admin/locations returns a plain array
      setLocations(Array.isArray(locData) ? locData : locData.locations ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = () => loadAll(true);

  const handleDeploy = async (packageId: number, locationId: number) => {
    try {
      const res = await fetch(`${BASE}/service-packages/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, locationId, deployedBy: "admin" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDeployments((prev) => {
        const existing = prev.find((d) => d.id === data.deployment.id);
        if (existing) return prev.map((d) => (d.id === data.deployment.id ? data.deployment : d));
        const loc = locations.find((l) => l.id === locationId);
        const pkg = packages.find((p) => p.id === packageId);
        return [
          ...prev,
          {
            ...data.deployment,
            locationName: loc?.name ?? null,
            packageName: pkg?.name ?? null,
          },
        ];
      });
    } catch {
      Alert.alert("Error", "Could not deploy package. Please try again.");
    }
  };

  const handleUndeploy = async (deploymentId: number) => {
    try {
      const res = await fetch(`${BASE}/service-packages/deployments/${deploymentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeployments((prev) => prev.filter((d) => d.id !== deploymentId));
    } catch {
      Alert.alert("Error", "Could not remove deployment. Please try again.");
    }
  };

  const handleEdit = (pkg: ServicePackage) => {
    setEditingPkg(pkg);
    setShowEditModal(true);
  };

  const handleSaved = (updated: ServicePackage) => {
    setPackages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleDelete = (pkg: ServicePackage) => {
    Alert.alert(
      "Remove Package",
      `Remove "${pkg.name}"? This will also remove all branch deployments for this package.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${BASE}/admin/service-packages/${pkg.id}`, { method: "DELETE" });
              if (res.ok) {
                setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
                setDeployments((prev) => prev.filter((d) => d.packageId !== pkg.id));
              } else {
                Alert.alert("Error", "Could not remove package.");
              }
            } catch {
              Alert.alert("Error", "Could not remove package.");
            }
          },
        },
      ]
    );
  };

  const pickAndImport = async (endpoint: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setImporting(true);

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.name ?? "import.xlsx",
        type: asset.mimeType ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      } as unknown as Blob);

      const res = await fetch(`${BASE}/${endpoint}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok && !data.errors) {
        Alert.alert("Import Failed", data.error ?? "Unknown error");
        return;
      }

      setImportResult({
        imported: data.imported ?? 0,
        updated: data.updated ?? 0,
        errors: data.errors ?? [],
      });
      setShowImportResult(true);

      // Refresh data
      await loadAll(true);
    } catch (e) {
      Alert.alert("Error", "Could not import file. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleImportPress = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Import Packages",
          message: "Choose the file format to import",
          options: ["Cancel", "Standard Format (Packages + Lines)", "Dealer Kit Menu (brand/model Excel)"],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) pickAndImport("service-packages/upload");
          if (i === 2) pickAndImport("service-packages/import-menu-kits");
        }
      );
    } else {
      Alert.alert(
        "Import Packages",
        "Choose the file format",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Standard Format (Packages + Lines)", onPress: () => pickAndImport("service-packages/upload") },
          { text: "Dealer Kit Menu (brand/model Excel)", onPress: () => pickAndImport("service-packages/import-menu-kits") },
        ]
      );
    }
  };

  const filtered = packages.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q) ||
      (p.vehicleModel ?? "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Service Packages" showNotifications={false} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Service Packages" showNotifications={false} />

      {/* Search + import bar */}
      <View style={[styles.toolbar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search packages…"
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
        <Pressable
          style={[styles.importBtn, importing && styles.importBtnDisabled]}
          onPress={handleImportPress}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="upload" size={15} color="#fff" />
              <Text style={styles.importBtnText}>Import</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: colors.mutedForeground }]}>
          {filtered.length} package{filtered.length !== 1 ? "s" : ""}
          {search ? ` matching "${search}"` : ""}
        </Text>
        <Text style={[styles.countText, { color: colors.mutedForeground }]}>
          {locations.length} branch{locations.length !== 1 ? "es" : ""}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="package" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search ? "No packages found" : "No service packages yet"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {search
                ? "Try a different search term"
                : `Tap "Import" to upload packages from Excel`}
            </Text>
          </View>
        ) : (
          filtered.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              deployments={deployments}
              locations={locations}
              onDeploy={handleDeploy}
              onUndeploy={handleUndeploy}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))
        )}
      </ScrollView>

      <ImportResultModal
        visible={showImportResult}
        result={importResult}
        onClose={() => setShowImportResult(false)}
      />

      <EditPackageModal
        visible={showEditModal}
        pkg={editingPkg}
        onClose={() => setShowEditModal(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

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
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dc2626",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  importBtnDisabled: { opacity: 0.6 },
  importBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },

  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  countText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  list: { padding: 12, gap: 10 },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
    padding: 24,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  // Card
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  cardAccent: { width: 4 },
  cardMain: { flex: 1, padding: 14, gap: 8 },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { flex: 1, gap: 2 },
  pkgName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pkgSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  pkgDescription: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  totalText: { marginLeft: "auto" as const, fontSize: 14, fontFamily: "Inter_700Bold" },

  // Expanded
  expandedBody: { borderTopWidth: 1, padding: 14, gap: 0 },
  expandSection: {},
  expandSectionTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  lineGroup: { marginBottom: 10 },
  lineGroupTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  lineRowLeft: { flexDirection: "row", alignItems: "flex-start", gap: 6, flex: 1 },
  lineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  lineBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  lineDesc: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },
  lineRowRight: { alignItems: "flex-end", gap: 2 },
  lineDetail: { fontSize: 11, fontFamily: "Inter_400Regular" },
  lineTotal: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
  totalLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  totalValue: { fontSize: 16, fontFamily: "Inter_700Bold" },

  // Deploy toggles
  deployRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  deployRowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  deployDot: { width: 8, height: 8, borderRadius: 4 },
  deployLocationName: { fontSize: 13, fontFamily: "Inter_400Regular" },
  deployChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deployChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    paddingTop: 10,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#1d4ed8",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: "auto" as const,
  },
  deleteBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#dc2626",
  },

  // Import modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalHeader: { alignItems: "center", gap: 8 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  modalStats: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  modalStat: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  modalStatNum: { fontSize: 24, fontFamily: "Inter_700Bold" },
  modalStatLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  errorList: { maxHeight: 160 },
  errorRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-start",
  },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  modalClose: {
    backgroundColor: "#dc2626",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
