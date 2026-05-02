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

interface CountItem {
  id: number;
  partNumber: string;
  partName: string;
  binCode: string | null;
  expectedQty: number;
  countedQty: number | null;
}

interface CountSession {
  id: number;
  sessionNumber: string;
  status: "in_progress" | "completed" | "cancelled";
  startedBy: string;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  itemCount?: number;
  variance?: number;
}

export default function PartsCount() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userCode } = useAuth();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSession, setActiveSession] = useState<CountSession | null>(null);
  const [sessionItems, setSessionItems] = useState<CountItem[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);

  const [scanInput, setScanInput] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [completingLoading, setCompletingLoading] = useState(false);

  const [startModalVisible, setStartModalVisible] = useState(false);
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const scanRef = useRef<TextInput>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/parts/count-sessions`);
      if (res.ok) {
        const d = await res.json();
        setSessions(d.sessions ?? []);
        const inProg = (d.sessions ?? []).find((s: CountSession) => s.status === "in_progress");
        if (inProg && !activeSession) {
          openSession(inProg);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const openSession = async (session: CountSession) => {
    setSessionLoading(true);
    setActiveSession(session);
    try {
      const res = await fetch(`${BASE}/parts/count-sessions/${session.id}`);
      if (res.ok) {
        const d = await res.json();
        setActiveSession(d.session ?? session);
        setSessionItems(d.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setSessionLoading(false);
    }
  };

  const startNewSession = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${BASE}/parts/count-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedBy: userCode, notes: newNotes }),
      });
      if (res.ok) {
        const d = await res.json();
        setStartModalVisible(false);
        setNewNotes("");
        await loadSessions();
        if (d.session) openSession(d.session);
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleScanCount = async () => {
    if (!activeSession || !scanInput.trim()) return;
    setScanLoading(true);
    setScanError("");
    try {
      const res = await fetch(`${BASE}/parts/items/by-number/${encodeURIComponent(scanInput.trim())}`);
      if (!res.ok) {
        setScanError(`Part "${scanInput.trim()}" not found`);
        return;
      }
      const part = await res.json();
      const exists = sessionItems.find((i) => i.partNumber === part.partNumber);
      if (exists) {
        setScanError(`${part.partNumber} already in this count session`);
        return;
      }
      const addRes = await fetch(`${BASE}/parts/count-sessions/${activeSession.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumber: part.partNumber,
          partName: part.name,
          binCode: part.binCode,
          expectedQty: part.qtyOnHand,
        }),
      });
      if (addRes.ok) {
        const d = await addRes.json();
        setSessionItems((prev) => [...prev, d.item]);
        setScanInput("");
      }
    } catch {
      setScanError("Network error — please try again");
    } finally {
      setScanLoading(false);
    }
  };

  const updateCount = async (item: CountItem, val: number) => {
    if (!activeSession) return;
    const clamped = Math.max(0, val);
    setSessionItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, countedQty: clamped } : i))
    );
    try {
      await fetch(`${BASE}/parts/count-sessions/${activeSession.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumber: item.partNumber,
          partName: item.partName,
          binCode: item.binCode,
          expectedQty: item.expectedQty,
          countedQty: clamped,
          countItemId: item.id,
        }),
      });
    } catch {
      // ignore
    }
  };

  const completeSession = async () => {
    if (!activeSession) return;
    setCompletingLoading(true);
    try {
      const res = await fetch(`${BASE}/parts/count-sessions/${activeSession.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setActiveSession(null);
        setSessionItems([]);
        await loadSessions();
      }
    } catch {
      // ignore
    } finally {
      setCompletingLoading(false);
    }
  };

  const countedItems = sessionItems.filter((i) => i.countedQty !== null).length;
  const totalVariance = sessionItems.reduce((acc, i) => acc + (i.countedQty !== null ? (i.countedQty - i.expectedQty) : 0), 0);

  const onRefresh = () => { setRefreshing(true); loadSessions(); };

  if (activeSession) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.sessionHeader, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => { setActiveSession(null); setSessionItems([]); }} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sessionTitle, { color: colors.foreground }]}>{activeSession.sessionNumber}</Text>
            <Text style={[styles.sessionSub, { color: colors.mutedForeground }]}>
              {countedItems}/{sessionItems.length} counted · Variance: {totalVariance > 0 ? "+" : ""}{totalVariance}
            </Text>
          </View>
          {activeSession.status === "in_progress" && (
            <Pressable
              onPress={completeSession}
              style={[styles.completeBtn, { backgroundColor: completingLoading ? "#16a34a80" : "#16a34a" }]}
              disabled={completingLoading}
            >
              {completingLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.completeBtnText}>Complete</Text>}
            </Pressable>
          )}
        </View>

        {activeSession.status === "in_progress" && (
          <View style={[styles.scanBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TextInput
              ref={scanRef}
              style={[styles.scanInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Scan or enter part number…"
              placeholderTextColor={colors.mutedForeground}
              value={scanInput}
              onChangeText={(v) => { setScanInput(v); setScanError(""); }}
              onSubmitEditing={handleScanCount}
              returnKeyType="search"
              autoCapitalize="characters"
            />
            <Pressable
              style={[styles.scanBtn, { backgroundColor: "#7c3aed", opacity: scanLoading ? 0.7 : 1 }]}
              onPress={handleScanCount}
              disabled={scanLoading}
            >
              {scanLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="plus" size={18} color="#fff" />}
            </Pressable>
          </View>
        )}
        {scanError ? (
          <Text style={[styles.scanError, { backgroundColor: "#fef2f2" }]}>{scanError}</Text>
        ) : null}

        {sessionLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        ) : (
          <FlatList
            data={sessionItems}
            keyExtractor={(i) => String(i.id)}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.center}>
                <Feather name="package" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Scan parts to add them to this count</Text>
              </View>
            }
            renderItem={({ item }) => {
              const variance = item.countedQty !== null ? item.countedQty - item.expectedQty : null;
              const vColor = variance === null ? colors.mutedForeground : variance < 0 ? "#dc2626" : variance > 0 ? "#d97706" : "#16a34a";
              return (
                <View style={[styles.countCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: item.countedQty !== null ? vColor : colors.border }]}>
                  <View style={styles.countHeader}>
                    <View style={[styles.pnBadge, { backgroundColor: "#7c3aed20" }]}>
                      <Text style={[styles.pnText, { color: "#7c3aed" }]}>{item.partNumber}</Text>
                    </View>
                    {item.binCode && (
                      <View style={[styles.binBadge, { backgroundColor: colors.secondary }]}>
                        <Feather name="grid" size={10} color={colors.mutedForeground} />
                        <Text style={[styles.binText, { color: colors.mutedForeground }]}>Bin {item.binCode}</Text>
                      </View>
                    )}
                    {variance !== null && (
                      <View style={[styles.varBadge, { backgroundColor: vColor + "20" }]}>
                        <Text style={[styles.varText, { color: vColor }]}>
                          {variance > 0 ? "+" : ""}{variance}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.countName, { color: colors.foreground }]} numberOfLines={1}>{item.partName}</Text>
                  <View style={styles.countRow}>
                    <Text style={[styles.expectedLabel, { color: colors.mutedForeground }]}>Expected: {item.expectedQty}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.countedLabel, { color: colors.foreground }]}>Counted:</Text>
                    {activeSession.status === "in_progress" ? (
                      <View style={styles.qtyControls}>
                        <Pressable
                          onPress={() => updateCount(item, (item.countedQty ?? item.expectedQty) - 1)}
                          style={[styles.qtyBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                        >
                          <Feather name="minus" size={14} color={colors.foreground} />
                        </Pressable>
                        <TextInput
                          style={[styles.qtyInput, { color: colors.foreground, borderColor: colors.border }]}
                          value={item.countedQty !== null ? String(item.countedQty) : ""}
                          placeholder={String(item.expectedQty)}
                          placeholderTextColor={colors.mutedForeground}
                          onChangeText={(v) => updateCount(item, parseInt(v) || 0)}
                          keyboardType="number-pad"
                        />
                        <Pressable
                          onPress={() => updateCount(item, (item.countedQty ?? item.expectedQty) + 1)}
                          style={[styles.qtyBtn, { backgroundColor: "#7c3aed20", borderColor: "#7c3aed" }]}
                        >
                          <Feather name="plus" size={14} color="#7c3aed" />
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={[styles.countedValue, { color: colors.foreground }]}>{item.countedQty ?? "—"}</Text>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Inventory Count"
        subtitle="Cycle count sessions"
        showNotifications={false}
        rightElement={
          <Pressable
            style={[styles.newBtn, { backgroundColor: "#7c3aed" }]}
            onPress={() => setStartModalVisible(true)}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newBtnText}>New Count</Text>
          </Pressable>
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="clipboard" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No count sessions yet</Text>
              <Pressable style={[styles.startBtn, { backgroundColor: "#7c3aed" }]} onPress={() => setStartModalVisible(true)}>
                <Text style={styles.startBtnText}>Start First Count</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item: session }) => {
            const isActive = session.status === "in_progress";
            return (
              <Pressable
                style={[
                  styles.sessionCard,
                  { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: isActive ? "#7c3aed" : colors.border }
                ]}
                onPress={() => openSession(session)}
              >
                <View style={styles.sessionRow}>
                  <Text style={[styles.sessionNum, { color: colors.foreground }]}>{session.sessionNumber}</Text>
                  <View style={[styles.badge, { backgroundColor: isActive ? "#ede9fe" : colors.secondary }]}>
                    <Text style={[styles.badgeText, { color: isActive ? "#7c3aed" : colors.mutedForeground }]}>
                      {isActive ? "In Progress" : session.status === "completed" ? "Completed" : "Cancelled"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                  By {session.startedBy} · {new Date(session.createdAt).toLocaleDateString()}
                  {session.itemCount !== undefined ? ` · ${session.itemCount} items` : ""}
                </Text>
                {session.variance !== undefined && session.status === "completed" && (
                  <Text style={[styles.varianceLine, { color: session.variance === 0 ? "#16a34a" : "#d97706" }]}>
                    Variance: {session.variance > 0 ? "+" : ""}{session.variance} units
                  </Text>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={startModalVisible} transparent animationType="slide" onRequestClose={() => setStartModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setStartModalVisible(false)}>
          <View style={[styles.startModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.startModalTitle, { color: colors.foreground }]}>Start New Count Session</Text>
            <Text style={[styles.startModalHint, { color: colors.mutedForeground }]}>
              You can add parts by scanning or entering part numbers once the session is created.
            </Text>
            <TextInput
              style={[styles.notesInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Optional notes (e.g. Zone A count)"
              placeholderTextColor={colors.mutedForeground}
              value={newNotes}
              onChangeText={setNewNotes}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setStartModalVisible(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, { backgroundColor: creating ? "#7c3aed80" : "#7c3aed" }]}
                onPress={startNewSession}
                disabled={creating}
              >
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmBtnText}>Start Count</Text>}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: Platform.OS === "ios" ? 60 : Platform.OS === "web" ? 72 : 24,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sessionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sessionSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  completeBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  completeBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scanBar: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
  },
  scanInput: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  scanBtn: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  scanError: { padding: 10, fontSize: 13, fontFamily: "Inter_400Regular", color: "#dc2626" },
  list: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  startBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  startBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sessionCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 13,
    gap: 4,
  },
  sessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sessionNum: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sessionMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  varianceLine: { fontSize: 12, fontFamily: "Inter_500Medium" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  newBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  countCard: { borderRadius: 10, borderWidth: 1, borderLeftWidth: 4, padding: 12, gap: 6 },
  countHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  pnBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pnText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  binBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  binText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  varBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: "auto" },
  varText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  countName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  countRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  expectedLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  countedLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  countedValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyInput: { width: 44, height: 30, borderRadius: 6, borderWidth: 1, textAlign: "center", fontSize: 14, fontFamily: "Inter_700Bold" },
  modalOverlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  startModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 24, gap: 14 },
  startModalTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  startModalHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  notesInput: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 70 },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  confirmBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  confirmBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
