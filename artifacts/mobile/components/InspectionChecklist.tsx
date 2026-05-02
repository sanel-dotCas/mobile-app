import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { VEHICLE_CHECKLIST } from "@/constants/inspectionChecklist";
import type { InspectionItem } from "@/context/JobsContext";
import { useJobs } from "@/context/JobsContext";
import { useColors } from "@/hooks/useColors";

type InspStatus = InspectionItem["status"];

const STATUS_CFG: Record<InspStatus, { icon: string; color: string; bg: string; label: string }> = {
  pending:   { icon: "minus",          color: "#94a3b8", bg: "#f1f5f9", label: "—"    },
  pass:      { icon: "check",          color: "#16a34a", bg: "#dcfce7", label: "Pass" },
  attention: { icon: "alert-triangle", color: "#d97706", bg: "#fef3c7", label: "Attn" },
  fail:      { icon: "x",             color: "#dc2626", bg: "#fee2e2", label: "Fail" },
};

const ACTION_STATUSES: InspStatus[] = ["pass", "attention", "fail"];

interface Props {
  jobId: string;
}

export function InspectionChecklist({ jobId }: Props) {
  const { getJob, addInspection, updateInspection, loadInspectionTemplate } = useJobs();
  const colors = useColors();
  const job = getJob(jobId);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["engine", "brakes"])
  );
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customNotes, setCustomNotes] = useState("");

  if (!job) return null;

  const passCount      = job.inspections.filter((i) => i.status === "pass").length;
  const attentionCount = job.inspections.filter((i) => i.status === "attention").length;
  const failCount      = job.inspections.filter((i) => i.status === "fail").length;
  const checkedCount   = passCount + attentionCount + failCount;
  const totalItems     = VEHICLE_CHECKLIST.reduce((s, sec) => s + sec.items.length, 0);

  const templateLoaded =
    job.inspections.filter((i) => i.templateId).length >= totalItems * 0.3;

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleStatusTap = (
    templateId: string,
    templateTitle: string,
    sectionId: string,
    defaultHours: number,
    existingItem: InspectionItem | undefined,
    tappedStatus: InspStatus,
  ) => {
    const newStatus: InspStatus =
      existingItem?.status === tappedStatus ? "pending" : tappedStatus;
    const notes = existingItem
      ? (localNotes[existingItem.id] ?? existingItem.notes)
      : "";

    if (!existingItem) {
      addInspection(jobId, {
        title: templateTitle,
        status: newStatus,
        estimatedHours: defaultHours,
        notes: "",
        templateId,
        section: sectionId,
      });
    } else {
      updateInspection(jobId, existingItem.id, newStatus, notes);
    }

    if ((newStatus === "attention" || newStatus === "fail") && existingItem) {
      setExpandedNotes((prev) => new Set([...prev, existingItem.id]));
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNoteBlur = (item: InspectionItem) => {
    const val = localNotes[item.id];
    if (val !== undefined && val !== item.notes) {
      updateInspection(jobId, item.id, item.status, val);
    }
  };

  const handleAddCustom = () => {
    if (!customTitle.trim()) return;
    addInspection(jobId, {
      title: customTitle.trim(),
      status: "pending",
      estimatedHours: 0,
      notes: customNotes.trim(),
    });
    setCustomTitle("");
    setCustomNotes("");
    setShowAddCustom(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLoadAll = () => {
    loadInspectionTemplate(jobId);
    setExpandedSections(new Set(VEHICLE_CHECKLIST.map((s) => s.id)));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const customItems = job.inspections.filter((i) => !i.templateId);

  return (
    <View style={styles.container}>
      {/* ── Progress summary ─────────────────────────────── */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
        <View style={styles.summaryRow}>
          {[
            { label: "Checked", value: `${checkedCount}/${totalItems}`, color: colors.foreground },
            { label: "Pass",      value: String(passCount),      color: "#16a34a" },
            { label: "Attention", value: String(attentionCount), color: "#d97706" },
            { label: "Fail",      value: String(failCount),      color: "#dc2626" },
          ].map(({ label, value, color }, i, arr) => (
            <React.Fragment key={label}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color }]}>{value}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
              {i < arr.length - 1 && (
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {!templateLoaded && (
          <Pressable onPress={handleLoadAll} style={styles.loadBtn}>
            <Feather name="clipboard" size={13} color="#fff" />
            <Text style={styles.loadBtnText}>Load Full DMS Vehicle Checklist</Text>
          </Pressable>
        )}
      </View>

      {/* ── Sections ─────────────────────────────────────── */}
      {VEHICLE_CHECKLIST.map((section) => {
        const sectionItems = job.inspections.filter((i) => i.section === section.id);
        const sPass   = sectionItems.filter((i) => i.status === "pass").length;
        const sAttn   = sectionItems.filter((i) => i.status === "attention").length;
        const sFail   = sectionItems.filter((i) => i.status === "fail").length;
        const hasIssues = sFail > 0 || sAttn > 0;
        const isExpanded = expandedSections.has(section.id);

        return (
          <View
            key={section.id}
            style={[
              styles.section,
              {
                backgroundColor: colors.card,
                borderColor: hasIssues ? "#fbbf24" : colors.border,
              },
            ]}
          >
            {/* Section header */}
            <Pressable onPress={() => toggleSection(section.id)} style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: section.color + "18" }]}>
                <Feather name={section.icon as any} size={14} color={section.color} />
              </View>
              <View style={styles.sectionTitleBlock}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {section.title}
                </Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  {sectionItems.length}/{section.items.length} checked
                </Text>
              </View>
              <View style={styles.sectionBadges}>
                {sPass > 0 && (
                  <View style={[styles.sBadge, { backgroundColor: "#dcfce7" }]}>
                    <Text style={[styles.sBadgeText, { color: "#16a34a" }]}>{sPass}✓</Text>
                  </View>
                )}
                {sAttn > 0 && (
                  <View style={[styles.sBadge, { backgroundColor: "#fef3c7" }]}>
                    <Text style={[styles.sBadgeText, { color: "#d97706" }]}>{sAttn}⚠</Text>
                  </View>
                )}
                {sFail > 0 && (
                  <View style={[styles.sBadge, { backgroundColor: "#fee2e2" }]}>
                    <Text style={[styles.sBadgeText, { color: "#dc2626" }]}>{sFail}✗</Text>
                  </View>
                )}
              </View>
              <Feather
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>

            {/* Items */}
            {isExpanded &&
              section.items.map((templateItem, idx) => {
                const existing = job.inspections.find(
                  (i) => i.templateId === templateItem.id,
                );
                const status: InspStatus = existing?.status ?? "pending";
                const cfg = STATUS_CFG[status];
                const noteKey = existing?.id ?? templateItem.id;
                const showNotes =
                  expandedNotes.has(noteKey) ||
                  status === "attention" ||
                  status === "fail";
                const noteVal = existing
                  ? (localNotes[existing.id] ?? existing.notes)
                  : "";

                return (
                  <View
                    key={templateItem.id}
                    style={[
                      styles.checkItem,
                      {
                        borderTopColor: colors.border,
                        borderTopWidth: idx === 0 ? 1 : 1,
                        backgroundColor:
                          status === "fail"
                            ? "#fff5f5"
                            : status === "attention"
                            ? "#fffbeb"
                            : "transparent",
                      },
                    ]}
                  >
                    <View style={styles.checkItemRow}>
                      {/* Status indicator dot */}
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: cfg.bg, borderColor: cfg.color },
                        ]}
                      >
                        <Feather
                          name={cfg.icon as any}
                          size={9}
                          color={cfg.color}
                        />
                      </View>

                      {/* Title */}
                      <Text
                        style={[
                          styles.checkItemTitle,
                          {
                            color:
                              status === "pending"
                                ? colors.mutedForeground
                                : colors.foreground,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {templateItem.title}
                      </Text>

                      {/* Status buttons */}
                      <View style={styles.statusBtns}>
                        {ACTION_STATUSES.map((s) => {
                          const sCfg = STATUS_CFG[s];
                          const isActive = status === s;
                          return (
                            <Pressable
                              key={s}
                              onPress={() =>
                                handleStatusTap(
                                  templateItem.id,
                                  templateItem.title,
                                  section.id,
                                  templateItem.defaultHours,
                                  existing,
                                  s,
                                )
                              }
                              style={[
                                styles.statusBtn,
                                {
                                  borderColor: isActive
                                    ? sCfg.color
                                    : colors.border,
                                  backgroundColor: isActive
                                    ? sCfg.bg
                                    : "transparent",
                                },
                              ]}
                            >
                              <Feather
                                name={sCfg.icon as any}
                                size={10}
                                color={isActive ? sCfg.color : colors.mutedForeground}
                              />
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Expand notes toggle */}
                      {existing && (
                        <Pressable
                          onPress={() =>
                            setExpandedNotes((prev) => {
                              const next = new Set(prev);
                              next.has(existing.id)
                                ? next.delete(existing.id)
                                : next.add(existing.id);
                              return next;
                            })
                          }
                          style={styles.notesToggle}
                        >
                          <Feather
                            name={showNotes ? "chevron-up" : "message-square"}
                            size={12}
                            color={
                              existing.notes
                                ? colors.primary
                                : colors.mutedForeground
                            }
                          />
                        </Pressable>
                      )}
                    </View>

                    {/* Notes input */}
                    {showNotes && existing && (
                      <TextInput
                        style={[
                          styles.notesInput,
                          {
                            borderColor: colors.border,
                            color: colors.foreground,
                            backgroundColor: colors.background,
                          },
                        ]}
                        placeholder="Add findings / observations…"
                        placeholderTextColor={colors.mutedForeground}
                        value={noteVal}
                        onChangeText={(v) =>
                          setLocalNotes((prev) => ({ ...prev, [existing.id]: v }))
                        }
                        onBlur={() => handleNoteBlur(existing)}
                        multiline
                      />
                    )}
                  </View>
                );
              })}
          </View>
        );
      })}

      {/* ── Custom items ─────────────────────────────────── */}
      {customItems.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.sectionHeader, { paddingBottom: 12 }]}>
            <Feather name="plus-circle" size={14} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginLeft: 6 }]}>
              Custom Items
            </Text>
            <View style={styles.sectionBadges}>
              <View style={[styles.sBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.sBadgeText, { color: colors.mutedForeground }]}>
                  {customItems.length}
                </Text>
              </View>
            </View>
          </View>
          {customItems.map((item, idx) => {
            const cfg = STATUS_CFG[item.status];
            return (
              <View
                key={item.id}
                style={[
                  styles.checkItem,
                  { borderTopColor: colors.border, borderTopWidth: idx === 0 ? 1 : 1 },
                ]}
              >
                <View style={styles.checkItemRow}>
                  <View style={[styles.statusDot, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                    <Feather name={cfg.icon as any} size={9} color={cfg.color} />
                  </View>
                  <Text style={[styles.checkItemTitle, { color: colors.foreground }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.statusBtns}>
                    {ACTION_STATUSES.map((s) => {
                      const sCfg = STATUS_CFG[s];
                      const isActive = item.status === s;
                      return (
                        <Pressable
                          key={s}
                          onPress={() => {
                            const newStatus: InspStatus =
                              item.status === s ? "pending" : s;
                            updateInspection(jobId, item.id, newStatus, item.notes);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          style={[
                            styles.statusBtn,
                            {
                              borderColor: isActive ? sCfg.color : colors.border,
                              backgroundColor: isActive ? sCfg.bg : "transparent",
                            },
                          ]}
                        >
                          <Feather
                            name={sCfg.icon as any}
                            size={10}
                            color={isActive ? sCfg.color : colors.mutedForeground}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                {item.notes ? (
                  <Text style={[styles.customNoteText, { color: colors.mutedForeground }]}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Add custom item ───────────────────────────────── */}
      <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {!showAddCustom ? (
          <Pressable onPress={() => setShowAddCustom(true)} style={styles.addTrigger}>
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={[styles.addTriggerText, { color: colors.primary }]}>
              Add Custom Inspection Item
            </Text>
          </Pressable>
        ) : (
          <View style={styles.addForm}>
            <Text style={[styles.addFormTitle, { color: colors.foreground }]}>Custom Item</Text>
            <TextInput
              style={[styles.addInput, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Inspection item title…"
              placeholderTextColor={colors.mutedForeground}
              value={customTitle}
              onChangeText={setCustomTitle}
              autoFocus
            />
            <TextInput
              style={[styles.addInput, { borderColor: colors.border, color: colors.foreground }]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={customNotes}
              onChangeText={setCustomNotes}
            />
            <View style={styles.addActions}>
              <Pressable
                onPress={() => { setShowAddCustom(false); setCustomTitle(""); setCustomNotes(""); }}
                style={[styles.addCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.addCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddCustom}
                style={[styles.addConfirmBtn, { backgroundColor: colors.primary, opacity: customTitle.trim() ? 1 : 0.5 }]}
                disabled={!customTitle.trim()}
              >
                <Text style={styles.addConfirmText}>Add Item</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { gap: 10 },

  summaryCard:      { borderRadius: 14, padding: 14, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  summaryRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  summaryItem:      { alignItems: "center", flex: 1, gap: 2 },
  summaryValue:     { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLabel:     { fontSize: 10, fontFamily: "Inter_400Regular" },
  summaryDivider:   { width: 1, height: 32 },
  loadBtn:          { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12, backgroundColor: "#1d4ed8", borderRadius: 10, paddingVertical: 10 },
  loadBtnText:      { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  section:          { borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  sectionHeader:    { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  sectionIconWrap:  { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sectionTitleBlock:{ flex: 1, gap: 1 },
  sectionTitle:     { fontSize: 13, fontFamily: "Inter_700Bold" },
  sectionSub:       { fontSize: 10, fontFamily: "Inter_400Regular" },
  sectionBadges:    { flexDirection: "row", gap: 4 },
  sBadge:           { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  sBadgeText:       { fontSize: 10, fontFamily: "Inter_700Bold" },

  checkItem:        { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  checkItemRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot:        { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkItemTitle:   { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  statusBtns:       { flexDirection: "row", gap: 4, flexShrink: 0 },
  statusBtn:        { width: 28, height: 28, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  notesToggle:      { width: 24, height: 24, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notesInput:       { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 12, fontFamily: "Inter_400Regular", minHeight: 48, marginTop: 2 },
  customNoteText:   { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", paddingLeft: 28 },

  addCard:          { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  addTrigger:       { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  addTriggerText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addForm:          { padding: 14, gap: 10 },
  addFormTitle:     { fontSize: 14, fontFamily: "Inter_700Bold" },
  addInput:         { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: "Inter_400Regular" },
  addActions:       { flexDirection: "row", gap: 10, marginTop: 4 },
  addCancelBtn:     { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  addCancelText:    { fontSize: 13, fontFamily: "Inter_500Medium" },
  addConfirmBtn:    { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  addConfirmText:   { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
