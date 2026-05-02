import { Feather } from "@expo/vector-icons";
import { Linking } from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

const getFormUrl = (token: string) =>
  Platform.OS === "web" && typeof window !== "undefined"
    ? `${window.location.origin}/api/parts/rfq/${token}/form`
    : `/api/parts/rfq/${token}/form`;

interface RfqItem { id: number; partName: string; partNumber?: string | null; qtyRequired: number; unitOfMeasure?: string | null; }
interface RfqSupplier { id: number; supplierName: string; contactEmail?: string | null; contactPhone?: string | null; submittedAt?: string | null; totalQuoted?: string | null; }
interface Rfq {
  id: number; rfqNumber: string; subject?: string | null; notes?: string | null;
  status: string; token: string; dueDate?: string | null; createdAt: string;
  items: RfqItem[]; suppliers: RfqSupplier[];
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#f1f5f9", color: "#64748b", label: "Draft" },
  sent: { bg: "#dbeafe", color: "#1d4ed8", label: "Sent" },
  received: { bg: "#dcfce7", color: "#16a34a", label: "Received" },
  closed: { bg: "#f1f5f9", color: "#94a3b8", label: "Closed" },
};

export default function PartsRfq() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userCode } = useAuth();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create RFQ form
  const [createModal, setCreateModal] = useState(false);
  const [formStep, setFormStep] = useState<1|2|3>(1);
  const [rfqSubject, setRfqSubject] = useState("");
  const [rfqNotes, setRfqNotes] = useState("");
  const [rfqDueDate, setRfqDueDate] = useState("");
  const [rfqItems, setRfqItems] = useState<{ partName: string; partNumber: string; qtyRequired: string; unitOfMeasure: string }[]>([]);
  const [rfqItemInput, setRfqItemInput] = useState({ partName: "", partNumber: "", qtyRequired: "1", unitOfMeasure: "EA" });
  const [rfqSuppliers, setRfqSuppliers] = useState<{ supplierName: string; contactEmail: string; contactPhone: string }[]>([]);
  const [rfqSupInput, setRfqSupInput] = useState({ supplierName: "", contactEmail: "", contactPhone: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [createdRfq, setCreatedRfq] = useState<Rfq | null>(null);

  // Detail modal
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/parts/rfq`);
      if (res.ok) { const d = await res.json(); setRfqs(d.rfqs ?? []); }
    } catch { /* */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitCreateRfq = async () => {
    if (!rfqSubject.trim() || rfqItems.length === 0) return;
    setCreateLoading(true);
    try {
      const res = await fetch(`${BASE}/parts/rfq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: rfqSubject.trim(), notes: rfqNotes.trim() || null,
          dueDate: rfqDueDate || null, createdBy: userCode,
          items: rfqItems.map(i => ({ partName: i.partName, partNumber: i.partNumber || null, qtyRequired: parseInt(i.qtyRequired) || 1, unitOfMeasure: i.unitOfMeasure })),
          suppliers: rfqSuppliers,
        }),
      });
      if (res.ok) {
        const rfq = await res.json();
        setCreatedRfq(rfq);
        setFormStep(3);
        load();
      }
    } catch { /* */ } finally { setCreateLoading(false); }
  };

  const resetForm = () => {
    setFormStep(1); setRfqSubject(""); setRfqNotes(""); setRfqDueDate("");
    setRfqItems([]); setRfqItemInput({ partName: "", partNumber: "", qtyRequired: "1", unitOfMeasure: "EA" });
    setRfqSuppliers([]); setRfqSupInput({ supplierName: "", contactEmail: "", contactPhone: "" });
    setCreatedRfq(null);
  };

  const shareWhatsApp = (rfq: Rfq, supplier?: RfqSupplier) => {
    const url = getFormUrl(rfq.token);
    const msg = `*RFQ: ${rfq.rfqNumber}*\n${rfq.subject ?? ""}\n\nPlease submit your quotation via this link:\n${url}\n\nItems needed:\n${rfq.items.map(i => `• ${i.partName}${i.partNumber ? ` (${i.partNumber})` : ""} — Qty ${i.qtyRequired}`).join("\n")}\n\nDue date: ${rfq.dueDate ? new Date(rfq.dueDate).toLocaleDateString("en-GB") : "ASAP"}`;
    const phone = supplier?.contactPhone?.replace(/\D/g, "") ?? "";
    const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl).catch(() => Alert.alert("Error", "Could not open WhatsApp"));
  };

  const shareEmail = (rfq: Rfq, supplier?: RfqSupplier) => {
    const url = getFormUrl(rfq.token);
    const subject = `RFQ ${rfq.rfqNumber}: ${rfq.subject ?? "Request for Quotation"}`;
    const body = `Dear ${supplier?.supplierName ?? "Supplier"},\n\nPlease find below our Request for Quotation.\n\nRFQ Number: ${rfq.rfqNumber}\nSubject: ${rfq.subject ?? ""}\n\nItems Required:\n${rfq.items.map(i => `- ${i.partName}${i.partNumber ? ` (${i.partNumber})` : ""}: ${i.qtyRequired} ${i.unitOfMeasure ?? "EA"}`).join("\n")}\n\nTo submit your quotation, please use this link:\n${url}\n\n${rfq.dueDate ? `Please respond by: ${new Date(rfq.dueDate).toLocaleDateString("en-GB")}\n\n` : ""}Best regards`;
    const to = supplier?.contactEmail ?? "";
    Linking.openURL(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() => Alert.alert("Error", "Could not open email client"));
  };

  const openDetail = async (rfq: Rfq) => {
    try {
      const res = await fetch(`${BASE}/parts/rfq`);
      if (res.ok) {
        const d = await res.json();
        const fresh = (d.rfqs ?? []).find((r: Rfq) => r.id === rfq.id);
        setSelectedRfq(fresh ?? rfq);
      }
    } catch { setSelectedRfq(rfq); }
  };

  const renderRfq = ({ item }: { item: Rfq }) => {
    const meta = STATUS_COLORS[item.status] ?? STATUS_COLORS.draft;
    return (
      <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => openDetail(item)}>
        <View style={styles.cardRow}>
          <Text style={[styles.rfqNum, { color: colors.foreground }]}>{item.rfqNumber}</Text>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        {item.subject ? <Text style={[styles.subject, { color: colors.foreground }]}>{item.subject}</Text> : null}
        <View style={styles.cardMeta}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.items.length} item{item.items.length !== 1 ? "s" : ""}</Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.suppliers.length} supplier{item.suppliers.length !== 1 ? "s" : ""}</Text>
          {item.dueDate && <Text style={[styles.metaText, { color: colors.mutedForeground }]}>Due {new Date(item.dueDate).toLocaleDateString()}</Text>}
        </View>
        <View style={styles.shareRow}>
          <Pressable onPress={() => shareWhatsApp(item)} style={[styles.shareBtn, { backgroundColor: "#dcfce7", borderColor: "#86efac" }]}>
            <Feather name="message-circle" size={13} color="#16a34a" />
            <Text style={[styles.shareBtnText, { color: "#16a34a" }]}>WhatsApp</Text>
          </Pressable>
          <Pressable onPress={() => shareEmail(item)} style={[styles.shareBtn, { backgroundColor: "#dbeafe", borderColor: "#93c5fd" }]}>
            <Feather name="mail" size={13} color="#1d4ed8" />
            <Text style={[styles.shareBtnText, { color: "#1d4ed8" }]}>Email</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="RFQ" subtitle="Request for Quotation" showNotifications={false} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : (
        <FlatList
          data={rfqs}
          keyExtractor={r => String(r.id)}
          renderItem={renderRfq}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 90 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="send" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No RFQs yet</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>Tap + to request quotes from suppliers</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <Pressable style={[styles.fab, { backgroundColor: "#7c3aed" }]} onPress={() => { resetForm(); setCreateModal(true); }}>
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      {/* ── Create RFQ Modal ─────────────────────────────── */}
      <Modal visible={createModal} animationType="slide" onRequestClose={() => { setCreateModal(false); resetForm(); }}>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
            <Pressable onPress={() => { if (formStep > 1 && formStep < 3) setFormStep(s => (s - 1) as 1|2|3); else { setCreateModal(false); resetForm(); } }} style={styles.headerBtn}>
              <Feather name={formStep > 1 && formStep < 3 ? "arrow-left" : "x"} size={22} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                {formStep === 3 ? "RFQ Created!" : "New RFQ"}
              </Text>
              {formStep < 3 && <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Step {formStep} of 2 — {formStep === 1 ? "Details & Items" : "Suppliers"}</Text>}
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad + 40 }}>

            {/* Step 1: Details + Items */}
            {formStep === 1 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>RFQ Details</Text>
                <View style={[styles.card, { borderColor: colors.border, gap: 10 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Subject *</Text>
                  <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="e.g. Q2 Spare Parts Order" placeholderTextColor={colors.mutedForeground} value={rfqSubject} onChangeText={setRfqSubject} />
                  <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Due Date</Text>
                  <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} value={rfqDueDate} onChangeText={setRfqDueDate} />
                  <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Notes (optional)</Text>
                  <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, minHeight: 60 }]} placeholder="Any special requirements..." placeholderTextColor={colors.mutedForeground} value={rfqNotes} onChangeText={setRfqNotes} multiline />
                </View>

                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Items Required</Text>
                <View style={[styles.card, { borderColor: colors.border, gap: 8 }]}>
                  <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="Part Name *" placeholderTextColor={colors.mutedForeground} value={rfqItemInput.partName} onChangeText={v => setRfqItemInput(p => ({ ...p, partName: v }))} />
                  <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="Part # (optional)" placeholderTextColor={colors.mutedForeground} value={rfqItemInput.partNumber} onChangeText={v => setRfqItemInput(p => ({ ...p, partNumber: v }))} autoCapitalize="characters" />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput style={[styles.input, { flex: 1, color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="Qty" placeholderTextColor={colors.mutedForeground} value={rfqItemInput.qtyRequired} onChangeText={v => setRfqItemInput(p => ({ ...p, qtyRequired: v }))} keyboardType="numeric" />
                    <TextInput style={[styles.input, { flex: 1, color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="Unit (EA/KG)" placeholderTextColor={colors.mutedForeground} value={rfqItemInput.unitOfMeasure} onChangeText={v => setRfqItemInput(p => ({ ...p, unitOfMeasure: v }))} autoCapitalize="characters" />
                  </View>
                  <Pressable style={{ backgroundColor: "#ede9fe", borderRadius: 8, padding: 10, alignItems: "center" }} onPress={() => { if (!rfqItemInput.partName.trim()) return; setRfqItems(prev => [...prev, { ...rfqItemInput }]); setRfqItemInput({ partName: "", partNumber: "", qtyRequired: "1", unitOfMeasure: "EA" }); }}>
                    <Text style={{ color: "#7c3aed", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>+ Add Item</Text>
                  </Pressable>
                </View>

                {rfqItems.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Items ({rfqItems.length})</Text>
                    {rfqItems.map((item, idx) => (
                      <View key={idx} style={[styles.card, { borderColor: colors.border, flexDirection: "row", alignItems: "flex-start", gap: 10 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.subject, { color: colors.foreground }]}>{item.partName}</Text>
                          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.partNumber || "—"} · Qty {item.qtyRequired} {item.unitOfMeasure}</Text>
                        </View>
                        <Pressable onPress={() => setRfqItems(prev => prev.filter((_, i) => i !== idx))}><Feather name="x" size={18} color="#ef4444" /></Pressable>
                      </View>
                    ))}
                  </>
                )}

                <Pressable style={[styles.actionBtn, { backgroundColor: rfqSubject.trim() && rfqItems.length > 0 ? "#7c3aed" : "#a78bfa" }]} onPress={() => { if (rfqSubject.trim() && rfqItems.length > 0) setFormStep(2); }} disabled={!rfqSubject.trim() || rfqItems.length === 0}>
                  <Text style={styles.actionBtnText}>Next: Add Suppliers →</Text>
                </Pressable>
              </>
            )}

            {/* Step 2: Suppliers */}
            {formStep === 2 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Suppliers to Quote</Text>
                <View style={[styles.card, { borderColor: colors.border, gap: 8 }]}>
                  <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="Supplier Name *" placeholderTextColor={colors.mutedForeground} value={rfqSupInput.supplierName} onChangeText={v => setRfqSupInput(p => ({ ...p, supplierName: v }))} />
                  <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="Email" placeholderTextColor={colors.mutedForeground} value={rfqSupInput.contactEmail} onChangeText={v => setRfqSupInput(p => ({ ...p, contactEmail: v }))} keyboardType="email-address" autoCapitalize="none" />
                  <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="WhatsApp / Phone" placeholderTextColor={colors.mutedForeground} value={rfqSupInput.contactPhone} onChangeText={v => setRfqSupInput(p => ({ ...p, contactPhone: v }))} keyboardType="phone-pad" />
                  <Pressable style={{ backgroundColor: "#ede9fe", borderRadius: 8, padding: 10, alignItems: "center" }} onPress={() => { if (!rfqSupInput.supplierName.trim()) return; setRfqSuppliers(prev => [...prev, { ...rfqSupInput }]); setRfqSupInput({ supplierName: "", contactEmail: "", contactPhone: "" }); }}>
                    <Text style={{ color: "#7c3aed", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>+ Add Supplier</Text>
                  </Pressable>
                </View>

                {rfqSuppliers.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Added ({rfqSuppliers.length})</Text>
                    {rfqSuppliers.map((s, idx) => (
                      <View key={idx} style={[styles.card, { borderColor: colors.border, flexDirection: "row", alignItems: "flex-start" }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.subject, { color: colors.foreground }]}>{s.supplierName}</Text>
                          {s.contactEmail ? <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{s.contactEmail}</Text> : null}
                          {s.contactPhone ? <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{s.contactPhone}</Text> : null}
                        </View>
                        <Pressable onPress={() => setRfqSuppliers(prev => prev.filter((_, i) => i !== idx))}><Feather name="x" size={18} color="#ef4444" /></Pressable>
                      </View>
                    ))}
                  </>
                )}

                <Pressable style={[styles.actionBtn, { backgroundColor: "#7c3aed", opacity: createLoading ? 0.7 : 1 }]} onPress={submitCreateRfq} disabled={createLoading}>
                  {createLoading ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="send" size={15} color="#fff" /><Text style={styles.actionBtnText}>Create RFQ</Text></>}
                </Pressable>
              </>
            )}

            {/* Step 3: Created — share links */}
            {formStep === 3 && createdRfq && (
              <>
                <View style={{ alignItems: "center", gap: 8, paddingVertical: 16 }}>
                  <Feather name="check-circle" size={52} color="#16a34a" />
                  <Text style={[styles.headerTitle, { color: colors.foreground }]}>{createdRfq.rfqNumber}</Text>
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>RFQ created · {createdRfq.items.length} items</Text>
                </View>

                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Supplier Form Link</Text>
                <View style={[styles.card, { borderColor: "#7c3aed", backgroundColor: "#ede9fe20", gap: 8 }]}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#7c3aed" }} numberOfLines={2} selectable>{getFormUrl(createdRfq.token)}</Text>
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>Suppliers use this link to submit prices. Share it below:</Text>
                </View>

                {createdRfq.suppliers.length > 0 ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Share with Suppliers</Text>
                    {createdRfq.suppliers.map((s, idx) => (
                      <View key={idx} style={[styles.card, { borderColor: colors.border, gap: 8 }]}>
                        <Text style={[styles.subject, { color: colors.foreground }]}>{s.supplierName}</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable onPress={() => shareWhatsApp(createdRfq, s)} style={[styles.shareBtn, { flex: 1, backgroundColor: "#dcfce7", borderColor: "#86efac", justifyContent: "center" }]}>
                            <Feather name="message-circle" size={14} color="#16a34a" />
                            <Text style={[styles.shareBtnText, { color: "#16a34a" }]}>WhatsApp</Text>
                          </Pressable>
                          <Pressable onPress={() => shareEmail(createdRfq, s)} style={[styles.shareBtn, { flex: 1, backgroundColor: "#dbeafe", borderColor: "#93c5fd", justifyContent: "center" }]}>
                            <Feather name="mail" size={14} color="#1d4ed8" />
                            <Text style={[styles.shareBtnText, { color: "#1d4ed8" }]}>Email</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </>
                ) : (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable onPress={() => shareWhatsApp(createdRfq)} style={[styles.shareBtn, { flex: 1, backgroundColor: "#dcfce7", borderColor: "#86efac", justifyContent: "center", paddingVertical: 12 }]}>
                      <Feather name="message-circle" size={14} color="#16a34a" />
                      <Text style={[styles.shareBtnText, { color: "#16a34a" }]}>Share on WhatsApp</Text>
                    </Pressable>
                    <Pressable onPress={() => shareEmail(createdRfq)} style={[styles.shareBtn, { flex: 1, backgroundColor: "#dbeafe", borderColor: "#93c5fd", justifyContent: "center", paddingVertical: 12 }]}>
                      <Feather name="mail" size={14} color="#1d4ed8" />
                      <Text style={[styles.shareBtnText, { color: "#1d4ed8" }]}>Send Email</Text>
                    </Pressable>
                  </View>
                )}

                <Pressable style={[styles.actionBtn, { backgroundColor: "#7c3aed" }]} onPress={() => { setCreateModal(false); resetForm(); }}>
                  <Text style={styles.actionBtnText}>Done</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── RFQ Detail Modal ──────────────────────────────── */}
      <Modal visible={!!selectedRfq} animationType="slide" onRequestClose={() => setSelectedRfq(null)}>
        {selectedRfq && (
          <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
              <Pressable onPress={() => setSelectedRfq(null)} style={styles.headerBtn}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>{selectedRfq.rfqNumber}</Text>
                <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{selectedRfq.subject}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[selectedRfq.status] ?? STATUS_COLORS.draft).bg }]}>
                <Text style={[styles.badgeText, { color: (STATUS_COLORS[selectedRfq.status] ?? STATUS_COLORS.draft).color }]}>{(STATUS_COLORS[selectedRfq.status] ?? STATUS_COLORS.draft).label}</Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPad + 30 }}>
              {/* Form link */}
              <View style={[styles.card, { borderColor: "#7c3aed", backgroundColor: "#ede9fe20", gap: 8 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="link" size={14} color="#7c3aed" />
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#7c3aed" }}>Supplier Form Link</Text>
                </View>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#7c3aed" }} selectable numberOfLines={2}>{getFormUrl(selectedRfq.token)}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => shareWhatsApp(selectedRfq)} style={[styles.shareBtn, { flex: 1, backgroundColor: "#dcfce7", borderColor: "#86efac", justifyContent: "center" }]}>
                    <Feather name="message-circle" size={13} color="#16a34a" />
                    <Text style={[styles.shareBtnText, { color: "#16a34a" }]}>WhatsApp</Text>
                  </Pressable>
                  <Pressable onPress={() => shareEmail(selectedRfq)} style={[styles.shareBtn, { flex: 1, backgroundColor: "#dbeafe", borderColor: "#93c5fd", justifyContent: "center" }]}>
                    <Feather name="mail" size={13} color="#1d4ed8" />
                    <Text style={[styles.shareBtnText, { color: "#1d4ed8" }]}>Email</Text>
                  </Pressable>
                </View>
              </View>

              {/* Items */}
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Items ({selectedRfq.items.length})</Text>
              {selectedRfq.items.map(item => (
                <View key={item.id} style={[styles.card, { borderColor: colors.border }]}>
                  <Text style={[styles.subject, { color: colors.foreground }]}>{item.partName}</Text>
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.partNumber ?? "—"} · Qty {item.qtyRequired} {item.unitOfMeasure ?? "EA"}</Text>
                </View>
              ))}

              {/* Supplier Responses */}
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Suppliers ({selectedRfq.suppliers.length})</Text>
              {selectedRfq.suppliers.length === 0 ? (
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>No responses yet</Text>
              ) : (
                selectedRfq.suppliers.map(s => (
                  <View key={s.id} style={[styles.card, { borderColor: s.submittedAt ? "#16a34a" : colors.border, gap: 6 }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Text style={[styles.subject, { color: colors.foreground }]}>{s.supplierName}</Text>
                      <View style={[styles.badge, { backgroundColor: s.submittedAt ? "#dcfce7" : "#f1f5f9" }]}>
                        <Text style={[styles.badgeText, { color: s.submittedAt ? "#16a34a" : "#64748b" }]}>{s.submittedAt ? "Quoted" : "Pending"}</Text>
                      </View>
                    </View>
                    {s.contactEmail && <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{s.contactEmail}</Text>}
                    {s.submittedAt && s.totalQuoted && (
                      <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#16a34a" }}>Total: USD {parseFloat(s.totalQuoted).toFixed(2)}</Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable onPress={() => shareWhatsApp(selectedRfq, s)} style={[styles.shareBtn, { backgroundColor: "#dcfce7", borderColor: "#86efac" }]}>
                        <Feather name="message-circle" size={12} color="#16a34a" />
                        <Text style={[styles.shareBtnText, { color: "#16a34a" }]}>WhatsApp</Text>
                      </Pressable>
                      <Pressable onPress={() => shareEmail(selectedRfq, s)} style={[styles.shareBtn, { backgroundColor: "#dbeafe", borderColor: "#93c5fd" }]}>
                        <Feather name="mail" size={12} color="#1d4ed8" />
                        <Text style={[styles.shareBtnText, { color: "#1d4ed8" }]}>Email</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: Platform.OS === "ios" ? 60 : 24, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  list: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 300, gap: 10 },
  emptyText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rfqNum: { fontSize: 15, fontFamily: "Inter_700Bold" },
  subject: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardMeta: { flexDirection: "row", gap: 12 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  shareRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  shareBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  fab: { position: "absolute", bottom: 100, right: 20, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 8 },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, padding: 14 },
  actionBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
