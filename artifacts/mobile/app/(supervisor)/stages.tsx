import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
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
import type { ProductionStage } from "@/context/StagesContext";
import { useStages } from "@/context/StagesContext";
import { useColors } from "@/hooks/useColors";

const PRESET_COLORS = [
  "#6366f1", "#0284c7", "#d97706", "#7c3aed", "#16a34a",
  "#dc2626", "#0891b2", "#be185d", "#64748b", "#f97316",
];

const PRESET_ICONS = [
  "inbox", "search", "tool", "check-square", "package",
  "truck", "shield", "star", "activity", "zap",
  "settings", "layers", "clipboard", "bar-chart-2", "wrench",
];

interface ModalState {
  visible: boolean;
  editing: ProductionStage | null;
  name: string;
  color: string;
  icon: string;
  expectedHours: string;
}

const EMPTY_MODAL: ModalState = {
  visible: false, editing: null, name: "", color: "#6366f1", icon: "inbox", expectedHours: "1",
};

export default function StagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sortedStages, addStage, updateStage, deleteStage, moveUp, moveDown } = useStages();
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const openAdd = () => setModal({ ...EMPTY_MODAL, visible: true });
  const openEdit = (s: ProductionStage) =>
    setModal({ visible: true, editing: s, name: s.name, color: s.color, icon: s.icon, expectedHours: String(s.expectedHours) });
  const closeModal = () => setModal(EMPTY_MODAL);

  const handleSave = () => {
    if (!modal.name.trim()) { Alert.alert("Required", "Stage name is required."); return; }
    const hours = parseFloat(modal.expectedHours) || 1;
    if (modal.editing) {
      updateStage({ ...modal.editing, name: modal.name.trim(), color: modal.color, icon: modal.icon, expectedHours: hours });
    } else {
      addStage({ name: modal.name.trim(), color: modal.color, icon: modal.icon, expectedHours: hours });
    }
    closeModal();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (stage: ProductionStage) => {
    Alert.alert(
      "Delete Stage",
      `Delete "${stage.name}"? Jobs in this stage will keep their current position but the stage label will be missing until reassigned.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: () => { deleteStage(stage.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Production Stages" subtitle="Configure workflow stages" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, { backgroundColor: colors.accent, borderColor: colors.primary + "30" }]}>
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            Stages define the production workflow. Use ↑↓ to reorder. Set expected hours for delay detection.
          </Text>
        </View>

        {sortedStages.map((stage, i) => (
          <View
            key={stage.id}
            style={[styles.stageRow, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: "#000" }]}
          >
            {/* Left color stripe */}
            <View style={[styles.colorStripe, { backgroundColor: stage.color }]} />

            {/* Icon */}
            <View style={[styles.stageIcon, { backgroundColor: stage.color + "20" }]}>
              <Feather name={stage.icon as any} size={20} color={stage.color} />
            </View>

            {/* Info */}
            <View style={styles.stageInfo}>
              <View style={styles.stageNameRow}>
                <View style={[styles.orderDot, { backgroundColor: stage.color }]}>
                  <Text style={styles.orderDotText}>{i + 1}</Text>
                </View>
                <Text style={[styles.stageName, { color: colors.foreground }]}>{stage.name}</Text>
              </View>
              <Text style={[styles.stageExpected, { color: colors.mutedForeground }]}>
                {stage.expectedHours}h expected duration
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.stageActions}>
              <Pressable
                onPress={() => { moveUp(stage.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                hitSlop={8}
                disabled={i === 0}
                style={[styles.actionBtn, { backgroundColor: colors.secondary, opacity: i === 0 ? 0.3 : 1 }]}
              >
                <Feather name="chevron-up" size={14} color={colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => { moveDown(stage.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                hitSlop={8}
                disabled={i === sortedStages.length - 1}
                style={[styles.actionBtn, { backgroundColor: colors.secondary, opacity: i === sortedStages.length - 1 ? 0.3 : 1 }]}
              >
                <Feather name="chevron-down" size={14} color={colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => openEdit(stage)}
                hitSlop={8}
                style={[styles.actionBtn, { backgroundColor: colors.accent }]}
              >
                <Feather name="edit-2" size={14} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => handleDelete(stage)}
                hitSlop={8}
                style={[styles.actionBtn, { backgroundColor: "#fee2e2" }]}
              >
                <Feather name="trash-2" size={14} color="#dc2626" />
              </Pressable>
            </View>
          </View>
        ))}

        {/* Pipeline preview */}
        <View style={[styles.pipelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.pipelineTitle, { color: colors.foreground }]}>Pipeline Preview</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.pipeline}>
              {sortedStages.map((stage, i) => (
                <React.Fragment key={stage.id}>
                  <View style={styles.pipelineStage}>
                    <View style={[styles.pipelineDot, { backgroundColor: stage.color }]}>
                      <Feather name={stage.icon as any} size={12} color="#fff" />
                    </View>
                    <Text style={[styles.pipelineLabel, { color: colors.foreground }]} numberOfLines={2}>
                      {stage.name}
                    </Text>
                    <Text style={[styles.pipelineHours, { color: colors.mutedForeground }]}>
                      {stage.expectedHours}h
                    </Text>
                  </View>
                  {i < sortedStages.length - 1 && (
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={styles.pipelineArrow} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* FAB Add */}
      <View style={[styles.fab, { bottom: bottomPad + 16 }]}>
        <Pressable onPress={openAdd} style={[styles.fabBtn, { backgroundColor: colors.primary }]}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.fabText}>Add Stage</Text>
        </Pressable>
      </View>

      {/* Add / Edit Modal */}
      <Modal visible={modal.visible} transparent animationType="slide" onRequestClose={closeModal}>
        <Pressable style={styles.overlay} onPress={closeModal}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {modal.editing ? "Edit Stage" : "New Stage"}
            </Text>

            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: modal.color + "15", borderColor: modal.color + "40" }]}>
              <View style={[styles.previewIcon, { backgroundColor: modal.color }]}>
                <Feather name={modal.icon as any} size={20} color="#fff" />
              </View>
              <View>
                <Text style={[styles.previewName, { color: colors.foreground }]}>
                  {modal.name || "Stage Name"}
                </Text>
                <Text style={[styles.previewHours, { color: colors.mutedForeground }]}>
                  {modal.expectedHours || "1"}h expected
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Name */}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Stage Name *</Text>
              <TextInput
                value={modal.name}
                onChangeText={(v) => setModal((m) => ({ ...m, name: v }))}
                placeholder="e.g. Body Repair"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />

              {/* Expected Hours */}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Expected Duration (hours) *</Text>
              <TextInput
                value={modal.expectedHours}
                onChangeText={(v) => setModal((m) => ({ ...m, expectedHours: v }))}
                placeholder="1"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />

              {/* Color */}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Color</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setModal((m) => ({ ...m, color: c }))}
                    style={[styles.colorSwatch, { backgroundColor: c }, modal.color === c && styles.colorSelected]}
                  >
                    {modal.color === c && <Feather name="check" size={14} color="#fff" />}
                  </Pressable>
                ))}
              </View>

              {/* Icon */}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Icon</Text>
              <View style={styles.iconGrid}>
                {PRESET_ICONS.map((ic) => (
                  <Pressable
                    key={ic}
                    onPress={() => setModal((m) => ({ ...m, icon: ic }))}
                    style={[
                      styles.iconOption,
                      { backgroundColor: modal.icon === ic ? modal.color : colors.secondary },
                    ]}
                  >
                    <Feather name={ic as any} size={18} color={modal.icon === ic ? "#fff" : colors.foreground} />
                  </Pressable>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.sheetActions}>
                <Pressable onPress={closeModal} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSave} style={[styles.saveBtn, { backgroundColor: modal.color }]}>
                  <Feather name={modal.editing ? "check" : "plus"} size={14} color="#fff" />
                  <Text style={styles.saveBtnText}>{modal.editing ? "Save Changes" : "Add Stage"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10 },

  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  stageRow: {
    flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, overflow: "hidden",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  colorStripe: { width: 4, alignSelf: "stretch" },
  stageIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", margin: 12 },
  stageInfo: { flex: 1, gap: 3 },
  stageNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderDot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  orderDotText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  stageName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  stageExpected: { fontSize: 12, fontFamily: "Inter_400Regular" },
  stageActions: { flexDirection: "row", gap: 6, paddingRight: 12, paddingLeft: 8 },
  actionBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  pipelineCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 4 },
  pipelineTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  pipeline: { flexDirection: "row", alignItems: "center", gap: 4 },
  pipelineStage: { alignItems: "center", gap: 4, minWidth: 60 },
  pipelineDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pipelineLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center", maxWidth: 60 },
  pipelineHours: { fontSize: 9, fontFamily: "Inter_400Regular" },
  pipelineArrow: { marginTop: -16 },

  fab: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  fabBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 50, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  fabText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 16 },

  preview: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 16 },
  previewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  previewName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  previewHours: { fontSize: 12, fontFamily: "Inter_400Regular" },

  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_400Regular" },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  colorSelected: { borderWidth: 2.5, borderColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },

  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconOption: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  sheetActions: { flexDirection: "row", gap: 12, marginTop: 20, marginBottom: 8 },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 12, borderWidth: 1.5 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  saveBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12 },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});
