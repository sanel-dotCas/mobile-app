import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

type RoStatus = "pending" | "picking" | "issued" | "cancelled";
type TrfStatus = "requested" | "approved" | "shipped" | "received" | "cancelled";

interface RoRequestItem {
  id: number;
  partNumber: string;
  partName: string;
  qtyRequested: number;
  qtyIssued: number;
  unitCost: string | null;
  notes: string | null;
  issuing?: number;
}

interface RoRequest {
  id: number;
  requestNumber: string;
  roNumber: string;
  department: string;
  status: RoStatus;
  requestedBy: string;
  notes: string | null;
  createdAt: string;
  issuedAt: string | null;
  items: RoRequestItem[];
}

interface TransferItem {
  id: number;
  partNumber: string;
  partName: string;
  qtyRequested: number;
  qtyShipped: number;
  qtyReceived: number;
}

interface Transfer {
  id: number;
  transferNumber: string;
  fromBranch: string;
  toBranch: string;
  status: TrfStatus;
  requestedBy: string;
  notes: string | null;
  createdAt: string;
  items: TransferItem[];
}

const RO_STATUS: Record<RoStatus, { color: string; bg: string; label: string }> = {
  pending:   { color: "#d97706", bg: "#fef3c7", label: "Pending" },
  picking:   { color: "#1d4ed8", bg: "#dbeafe", label: "Picking" },
  issued:    { color: "#16a34a", bg: "#dcfce7", label: "Issued" },
  cancelled: { color: "#ef4444", bg: "#fee2e2", label: "Cancelled" },
};

const TRF_STATUS: Record<TrfStatus, { color: string; bg: string; label: string }> = {
  requested: { color: "#d97706", bg: "#fef3c7", label: "Requested" },
  approved:  { color: "#1d4ed8", bg: "#dbeafe", label: "Approved" },
  shipped:   { color: "#7c3aed", bg: "#ede9fe", label: "Shipped" },
  received:  { color: "#16a34a", bg: "#dcfce7", label: "Received" },
  cancelled: { color: "#ef4444", bg: "#fee2e2", label: "Cancelled" },
};

const DEPT_META: Record<string, { color: string; bg: string }> = {
  Service:    { color: "#1d4ed8", bg: "#dbeafe" },
  "Body Shop": { color: "#d97706", bg: "#fef3c7" },
};

export default function PartsRequests() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userCode } = useAuth();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [tab, setTab] = useState<"ro" | "transfers">("ro");

  // RO Requests
  const [roRequests, setRoRequests] = useState<RoRequest[]>([]);
  const [roLoading, setRoLoading] = useState(true);
  const [roRefreshing, setRoRefreshing] = useState(false);
  const [selectedRo, setSelectedRo] = useState<RoRequest | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(false);
  const [newRoModal, setNewRoModal] = useState(false);

  // New RO form
  const [roNumber, setRoNumber] = useState("");
  const [roDept, setRoDept] = useState<"Service" | "Body Shop">("Service");
  const [roNotes, setRoNotes] = useState("");
  const [roItems, setRoItems] = useState<Array<{ partNumber: string; partName: string; qty: string }>>([]);
  const [roSubmitting, setRoSubmitting] = useState(false);
  const [roScanInput, setRoScanInput] = useState("");
  const [roScanLoading, setRoScanLoading] = useState(false);
  const [roScanError, setRoScanError] = useState("");
  const roScanRef = useRef<TextInput>(null);

  // Transfers
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [tLoading, setTLoading] = useState(true);
  const [tRefreshing, setTRefreshing] = useState(false);
  const [selectedTrf, setSelectedTrf] = useState<Transfer | null>(null);
  const [newTrfModal, setNewTrfModal] = useState(false);

  // New transfer form
  const [trfFrom, setTrfFrom] = useState("Main Branch");
  const [trfTo, setTrfTo] = useState("");
  const [trfNotes, setTrfNotes] = useState("");
  const [trfItems, setTrfItems] = useState<Array<{ partNumber: string; partName: string; qty: string }>>([]);
  const [trfSubmitting, setTrfSubmitting] = useState(false);
  const [trfScanInput, setTrfScanInput] = useState("");
  const [trfScanLoading, setTrfScanLoading] = useState(false);
  const [trfScanError, setTrfScanError] = useState("");
  const trfScanRef = useRef<TextInput>(null);

  const loadRo = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/parts/ro-requests`);
      if (res.ok) {
        const d = await res.json();
        setRoRequests(d.requests ?? []);
      }
    } catch {
      //
    } finally {
      setRoLoading(false);
      setRoRefreshing(false);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/parts/transfers`);
      if (res.ok) {
        const d = await res.json();
        setTransfers(d.transfers ?? []);
      }
    } catch {
      //
    } finally {
      setTLoading(false);
      setTRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRo(); loadTransfers(); }, [loadRo, loadTransfers]);

  const openRo = async (req: RoRequest) => {
    try {
      const res = await fetch(`${BASE}/parts/ro-requests/${req.id}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedRo({ ...d, items: d.items.map((i: RoRequestItem) => ({ ...i, issuing: Math.max(0, i.qtyRequested - i.qtyIssued) })) });
        setIssueSuccess(false);
      }
    } catch {
      setSelectedRo({ ...req, items: req.items.map((i) => ({ ...i, issuing: Math.max(0, i.qtyRequested - i.qtyIssued) })) });
    }
  };

  const openTrf = async (t: Transfer) => {
    try {
      const res = await fetch(`${BASE}/parts/transfers/${t.id}`);
      if (res.ok) setSelectedTrf(await res.json());
    } catch {
      setSelectedTrf(t);
    }
  };

  const updateIssuing = (itemId: number, val: number) => {
    if (!selectedRo) return;
    setSelectedRo({
      ...selectedRo,
      items: selectedRo.items.map((i) =>
        i.id === itemId ? { ...i, issuing: Math.max(0, Math.min(val, i.qtyRequested - i.qtyIssued)) } : i
      ),
    });
  };

  const submitIssue = async () => {
    if (!selectedRo) return;
    setIssueLoading(true);
    try {
      const payload = {
        items: selectedRo.items
          .filter((i) => (i.issuing ?? 0) > 0)
          .map((i) => ({ requestItemId: i.id, qtyIssued: i.issuing ?? 0 })),
      };
      const res = await fetch(`${BASE}/parts/ro-requests/${selectedRo.id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIssueSuccess(true);
        loadRo();
        const updated = await res.json();
        if (updated.request) {
          setSelectedRo({ ...updated.request, items: updated.request.items.map((i: RoRequestItem) => ({ ...i, issuing: 0 })) });
        }
      }
    } catch {
      //
    } finally {
      setIssueLoading(false);
    }
  };

  const handleRoScan = async () => {
    if (!roScanInput.trim()) return;
    setRoScanLoading(true);
    setRoScanError("");
    try {
      const res = await fetch(`${BASE}/parts/items/by-number/${roScanInput.trim().toUpperCase()}`);
      if (res.ok) {
        const part = await res.json();
        setRoItems((prev) => [...prev, { partNumber: part.partNumber, partName: part.name, qty: "1" }]);
        setRoScanInput("");
      } else {
        setRoScanError("Part not found");
      }
    } catch {
      setRoScanError("Connection error");
    } finally {
      setRoScanLoading(false);
    }
  };

  const handleTrfScan = async () => {
    if (!trfScanInput.trim()) return;
    setTrfScanLoading(true);
    setTrfScanError("");
    try {
      const res = await fetch(`${BASE}/parts/items/by-number/${trfScanInput.trim().toUpperCase()}`);
      if (res.ok) {
        const part = await res.json();
        setTrfItems((prev) => [...prev, { partNumber: part.partNumber, partName: part.name, qty: "1" }]);
        setTrfScanInput("");
      } else {
        setTrfScanError("Part not found");
      }
    } catch {
      setTrfScanError("Connection error");
    } finally {
      setTrfScanLoading(false);
    }
  };

  const submitRoRequest = async () => {
    if (!roNumber.trim() || roItems.length === 0) return;
    setRoSubmitting(true);
    try {
      const res = await fetch(`${BASE}/parts/ro-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roNumber: roNumber.trim(),
          department: roDept,
          notes: roNotes.trim() || null,
          requestedBy: userCode,
          items: roItems.map((i) => ({ partNumber: i.partNumber, partName: i.partName, qtyRequested: parseInt(i.qty) || 1 })),
        }),
      });
      if (res.ok) {
        setNewRoModal(false);
        setRoNumber(""); setRoDept("Service"); setRoNotes(""); setRoItems([]);
        loadRo();
      }
    } catch {
      //
    } finally {
      setRoSubmitting(false);
    }
  };

  const submitTransfer = async () => {
    if (!trfTo.trim() || trfItems.length === 0) return;
    setTrfSubmitting(true);
    try {
      const res = await fetch(`${BASE}/parts/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBranch: trfFrom.trim(),
          toBranch: trfTo.trim(),
          notes: trfNotes.trim() || null,
          requestedBy: userCode,
          items: trfItems.map((i) => ({ partNumber: i.partNumber, partName: i.partName, qtyRequested: parseInt(i.qty) || 1 })),
        }),
      });
      if (res.ok) {
        setNewTrfModal(false);
        setTrfTo(""); setTrfNotes(""); setTrfItems([]);
        loadTransfers();
      }
    } catch {
      //
    } finally {
      setTrfSubmitting(false);
    }
  };

  const totalIssuing = selectedRo?.items.reduce((acc, i) => acc + (i.issuing ?? 0), 0) ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Requests" subtitle="RO Parts & Transfers" showNotifications={false} />

      <View style={styles.tabRow}>
        {([["ro", "tool", "RO Requests"], ["transfers", "shuffle", "Transfers"]] as const).map(([key, icon, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, { borderBottomColor: tab === key ? "#7c3aed" : "transparent", borderBottomWidth: 2 }]}
          >
            <Feather name={icon} size={14} color={tab === key ? "#7c3aed" : colors.mutedForeground} />
            <Text style={[styles.tabText, { color: tab === key ? "#7c3aed" : colors.mutedForeground }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "ro" ? (
        <>
          <Pressable
            style={[styles.newBtn, { backgroundColor: "#7c3aed" }]}
            onPress={() => { setNewRoModal(true); setRoItems([]); }}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newBtnText}>New RO Request</Text>
          </Pressable>

          {roLoading ? (
            <View style={styles.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
          ) : (
            <FlatList
              data={roRequests}
              keyExtractor={(r) => String(r.id)}
              contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={roRefreshing} onRefresh={() => { setRoRefreshing(true); loadRo(); }} />}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Feather name="tool" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No RO requests yet</Text>
                </View>
              }
              renderItem={({ item: req }) => {
                const meta = RO_STATUS[req.status];
                const deptMeta = DEPT_META[req.department] ?? { color: "#64748b", bg: "#f1f5f9" };
                return (
                  <Pressable
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: meta.color }]}
                    onPress={() => openRo(req)}
                  >
                    <View style={styles.cardRow}>
                      <Text style={[styles.cardNum, { color: colors.foreground }]}>{req.requestNumber}</Text>
                      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    <View style={styles.cardRow}>
                      <View style={[styles.deptBadge, { backgroundColor: deptMeta.bg }]}>
                        <Text style={[styles.deptText, { color: deptMeta.color }]}>{req.department}</Text>
                      </View>
                      <Text style={[styles.roNumText, { color: colors.foreground }]}>RO {req.roNumber}</Text>
                    </View>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                      {req.items.length} part{req.items.length !== 1 ? "s" : ""} · By {req.requestedBy} · {new Date(req.createdAt).toLocaleDateString()}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
        </>
      ) : (
        <>
          <Pressable
            style={[styles.newBtn, { backgroundColor: "#7c3aed" }]}
            onPress={() => { setNewTrfModal(true); setTrfItems([]); }}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newBtnText}>New Transfer Request</Text>
          </Pressable>

          {tLoading ? (
            <View style={styles.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
          ) : (
            <FlatList
              data={transfers}
              keyExtractor={(t) => String(t.id)}
              contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={tRefreshing} onRefresh={() => { setTRefreshing(true); loadTransfers(); }} />}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Feather name="shuffle" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transfers yet</Text>
                </View>
              }
              renderItem={({ item: trf }) => {
                const meta = TRF_STATUS[trf.status];
                return (
                  <Pressable
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: meta.color }]}
                    onPress={() => openTrf(trf)}
                  >
                    <View style={styles.cardRow}>
                      <Text style={[styles.cardNum, { color: colors.foreground }]}>{trf.transferNumber}</Text>
                      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    <View style={styles.branchRow}>
                      <Text style={[styles.branchText, { color: colors.foreground }]}>{trf.fromBranch}</Text>
                      <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.branchText, { color: colors.foreground }]}>{trf.toBranch}</Text>
                    </View>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                      {trf.items.length} item{trf.items.length !== 1 ? "s" : ""} · {new Date(trf.createdAt).toLocaleDateString()}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
        </>
      )}

      {/* RO Issue Modal */}
      <Modal visible={!!selectedRo} animationType="slide" onRequestClose={() => setSelectedRo(null)}>
        {selectedRo && (
          <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
              <Pressable onPress={() => setSelectedRo(null)} style={styles.backBtn}>
                <Feather name="x" size={22} color={colors.foreground} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>{selectedRo.requestNumber}</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>RO {selectedRo.roNumber} · {selectedRo.department}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: RO_STATUS[selectedRo.status].bg }]}>
                <Text style={[styles.badgeText, { color: RO_STATUS[selectedRo.status].color }]}>{RO_STATUS[selectedRo.status].label}</Text>
              </View>
            </View>

            {issueSuccess && (
              <View style={[styles.successBanner, { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" }]}>
                <Feather name="check-circle" size={16} color="#16a34a" />
                <Text style={{ color: "#16a34a", fontFamily: "Inter_500Medium", fontSize: 13 }}>Parts issued and stock updated</Text>
              </View>
            )}

            <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: bottomPad + 80 }]}>
              {selectedRo.notes && (
                <View style={[styles.notesBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{selectedRo.notes}</Text>
                </View>
              )}
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Parts Required</Text>
              {selectedRo.items.map((item) => {
                const remaining = item.qtyRequested - item.qtyIssued;
                return (
                  <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardRow}>
                      <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                        <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
                      </View>
                    </View>
                    <Text style={[styles.itemName, { color: colors.foreground }]}>{item.partName}</Text>
                    <Text style={[styles.qtyLabel, { color: colors.mutedForeground }]}>
                      Requested: {item.qtyRequested} · Issued: {item.qtyIssued} · Remaining: {remaining}
                    </Text>
                    {remaining > 0 && selectedRo.status !== "issued" && selectedRo.status !== "cancelled" && (
                      <View style={styles.issueRow}>
                        <Text style={[styles.issueLabel, { color: colors.foreground }]}>Issue now:</Text>
                        <Pressable
                          style={[styles.qtyBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                          onPress={() => updateIssuing(item.id, (item.issuing ?? 0) - 1)}
                        >
                          <Feather name="minus" size={16} color={colors.foreground} />
                        </Pressable>
                        <TextInput
                          style={[styles.qtyInput, { color: colors.foreground, borderColor: colors.border }]}
                          value={String(item.issuing ?? 0)}
                          onChangeText={(v) => updateIssuing(item.id, parseInt(v) || 0)}
                          keyboardType="number-pad"
                        />
                        <Pressable
                          style={[styles.qtyBtn, { backgroundColor: "#7c3aed20", borderColor: "#7c3aed" }]}
                          onPress={() => updateIssuing(item.id, (item.issuing ?? 0) + 1)}
                        >
                          <Feather name="plus" size={16} color="#7c3aed" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {selectedRo.status !== "issued" && selectedRo.status !== "cancelled" && totalIssuing > 0 && (
              <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: issueLoading ? "#7c3aed80" : "#7c3aed" }]}
                  onPress={submitIssue}
                  disabled={issueLoading}
                >
                  {issueLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Feather name="check" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Issue {totalIssuing} unit{totalIssuing !== 1 ? "s" : ""} to Workshop</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        )}
      </Modal>

      {/* Transfer Detail Modal */}
      <Modal visible={!!selectedTrf} animationType="slide" onRequestClose={() => setSelectedTrf(null)}>
        {selectedTrf && (
          <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
              <Pressable onPress={() => setSelectedTrf(null)} style={styles.backBtn}>
                <Feather name="x" size={22} color={colors.foreground} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>{selectedTrf.transferNumber}</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{selectedTrf.fromBranch} → {selectedTrf.toBranch}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: TRF_STATUS[selectedTrf.status].bg }]}>
                <Text style={[styles.badgeText, { color: TRF_STATUS[selectedTrf.status].color }]}>{TRF_STATUS[selectedTrf.status].label}</Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: bottomPad + 24 }]}>
              {selectedTrf.notes && (
                <View style={[styles.notesBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{selectedTrf.notes}</Text>
                </View>
              )}
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Transfer Items</Text>
              {selectedTrf.items.map((item) => (
                <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                    <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
                  </View>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{item.partName}</Text>
                  <Text style={[styles.qtyLabel, { color: colors.mutedForeground }]}>
                    Requested: {item.qtyRequested} · Shipped: {item.qtyShipped} · Received: {item.qtyReceived}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* New RO Request Modal */}
      <Modal visible={newRoModal} animationType="slide" onRequestClose={() => setNewRoModal(false)}>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
            <Pressable onPress={() => setNewRoModal(false)} style={styles.backBtn}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New RO Parts Request</Text>
          </View>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: bottomPad + 100 }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>RO Number *</Text>
            <TextInput
              style={[styles.formInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="e.g. RO-2026-0055"
              placeholderTextColor={colors.mutedForeground}
              value={roNumber}
              onChangeText={setRoNumber}
              autoCapitalize="characters"
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Department</Text>
            <View style={styles.deptRow}>
              {(["Service", "Body Shop"] as const).map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setRoDept(d)}
                  style={[styles.deptChip, { backgroundColor: roDept === d ? "#7c3aed" : colors.secondary, borderColor: roDept === d ? "#7c3aed" : colors.border }]}
                >
                  <Text style={[styles.deptChipText, { color: roDept === d ? "#fff" : colors.foreground }]}>{d}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
            <TextInput
              style={[styles.formInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Job description / notes"
              placeholderTextColor={colors.mutedForeground}
              value={roNotes}
              onChangeText={setRoNotes}
              multiline
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Parts Required</Text>
            <View style={styles.scanRow}>
              <TextInput
                ref={roScanRef}
                style={[styles.scanInputSmall, { color: colors.foreground, borderColor: colors.border, flex: 1 }]}
                placeholder="Scan or type part number"
                placeholderTextColor={colors.mutedForeground}
                value={roScanInput}
                onChangeText={(v) => { setRoScanInput(v); setRoScanError(""); }}
                autoCapitalize="characters"
                onSubmitEditing={handleRoScan}
                returnKeyType="search"
              />
              <Pressable
                style={[styles.scanActionBtn, { backgroundColor: roScanLoading ? "#7c3aed80" : "#7c3aed" }]}
                onPress={handleRoScan}
                disabled={roScanLoading}
              >
                {roScanLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="plus" size={18} color="#fff" />}
              </Pressable>
            </View>
            {roScanError ? <Text style={styles.scanError}>{roScanError}</Text> : null}
            {roItems.map((item, idx) => (
              <View key={idx} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardRow}>
                  <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                    <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
                  </View>
                  <Pressable onPress={() => setRoItems((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                    <Feather name="trash-2" size={15} color="#ef4444" />
                  </Pressable>
                </View>
                <Text style={[styles.itemName, { color: colors.foreground }]}>{item.partName}</Text>
                <View style={styles.qtyRow}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 0 }]}>Qty:</Text>
                  <TextInput
                    style={[styles.qtyInputSmall, { color: colors.foreground, borderColor: colors.border }]}
                    value={item.qty}
                    onChangeText={(v) => setRoItems((prev) => prev.map((p, i) => i === idx ? { ...p, qty: v } : p))}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: roSubmitting || !roNumber.trim() || roItems.length === 0 ? "#7c3aed80" : "#7c3aed" }]}
              onPress={submitRoRequest}
              disabled={roSubmitting || !roNumber.trim() || roItems.length === 0}
            >
              {roSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Feather name="send" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Submit Request</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* New Transfer Modal */}
      <Modal visible={newTrfModal} animationType="slide" onRequestClose={() => setNewTrfModal(false)}>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
            <Pressable onPress={() => setNewTrfModal(false)} style={styles.backBtn}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Inter-Branch Transfer</Text>
          </View>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: bottomPad + 100 }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>From Branch</Text>
            <TextInput
              style={[styles.formInput, { color: colors.foreground, borderColor: colors.border }]}
              value={trfFrom}
              onChangeText={setTrfFrom}
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>To Branch *</Text>
            <TextInput
              style={[styles.formInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="e.g. Airport Branch"
              placeholderTextColor={colors.mutedForeground}
              value={trfTo}
              onChangeText={setTrfTo}
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
            <TextInput
              style={[styles.formInput, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Transfer reason / notes"
              placeholderTextColor={colors.mutedForeground}
              value={trfNotes}
              onChangeText={setTrfNotes}
              multiline
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Parts to Transfer</Text>
            <View style={styles.scanRow}>
              <TextInput
                ref={trfScanRef}
                style={[styles.scanInputSmall, { color: colors.foreground, borderColor: colors.border, flex: 1 }]}
                placeholder="Scan or type part number"
                placeholderTextColor={colors.mutedForeground}
                value={trfScanInput}
                onChangeText={(v) => { setTrfScanInput(v); setTrfScanError(""); }}
                autoCapitalize="characters"
                onSubmitEditing={handleTrfScan}
                returnKeyType="search"
              />
              <Pressable
                style={[styles.scanActionBtn, { backgroundColor: trfScanLoading ? "#7c3aed80" : "#7c3aed" }]}
                onPress={handleTrfScan}
                disabled={trfScanLoading}
              >
                {trfScanLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="plus" size={18} color="#fff" />}
              </Pressable>
            </View>
            {trfScanError ? <Text style={styles.scanError}>{trfScanError}</Text> : null}
            {trfItems.map((item, idx) => (
              <View key={idx} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardRow}>
                  <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                    <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
                  </View>
                  <Pressable onPress={() => setTrfItems((prev) => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                    <Feather name="trash-2" size={15} color="#ef4444" />
                  </Pressable>
                </View>
                <Text style={[styles.itemName, { color: colors.foreground }]}>{item.partName}</Text>
                <View style={styles.qtyRow}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 0 }]}>Qty:</Text>
                  <TextInput
                    style={[styles.qtyInputSmall, { color: colors.foreground, borderColor: colors.border }]}
                    value={item.qty}
                    onChangeText={(v) => setTrfItems((prev) => prev.map((p, i) => i === idx ? { ...p, qty: v } : p))}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: trfSubmitting || !trfTo.trim() || trfItems.length === 0 ? "#7c3aed80" : "#7c3aed" }]}
              onPress={submitTransfer}
              disabled={trfSubmitting || !trfTo.trim() || trfItems.length === 0}
            >
              {trfSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Feather name="send" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Send Transfer Request</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "transparent" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, margin: 16, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  newBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 250, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 10, borderWidth: 1, borderLeftWidth: 4, padding: 13, gap: 4 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardNum: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  roNumText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  deptBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deptText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  branchRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  branchText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", flex: 1 },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  modalContent: { padding: 16, gap: 8 },
  modalFooter: { borderTopWidth: 1, padding: 16 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, borderRadius: 10, borderWidth: 1, padding: 10 },
  notesBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  itemCard: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  pnBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pnText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  itemName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  qtyLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  issueRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  issueLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  qtyBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyInput: { width: 50, height: 34, borderRadius: 8, borderWidth: 1, textAlign: "center", fontSize: 15, fontFamily: "Inter_700Bold" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, padding: 14 },
  actionBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#64748b", marginTop: 8, marginBottom: 4 },
  formInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  deptRow: { flexDirection: "row", gap: 8 },
  deptChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  deptChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scanRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  scanInputSmall: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  scanActionBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  scanError: { color: "#ef4444", fontSize: 12, fontFamily: "Inter_400Regular" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyInputSmall: { width: 50, height: 32, borderWidth: 1, borderRadius: 8, textAlign: "center", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
