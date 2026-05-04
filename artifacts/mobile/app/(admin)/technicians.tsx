import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type Technician = {
  id: string; name: string; role: string; userCode: string;
  avatar: string | null; specializations: string[] | null; status: string | null;
};

const TECH_ROLES = ["technician", "supervisor", "estimator", "parts"];

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  technician: { bg: "#dbeafe", text: "#1d4ed8" },
  supervisor: { bg: "#ede9fe", text: "#7c3aed" },
  estimator: { bg: "#dcfce7", text: "#16a34a" },
  parts: { bg: "#fef3c7", text: "#d97706" },
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLOR[role] ?? { bg: "#f1f5f9", text: "#64748b" };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{role}</Text>
    </View>
  );
}

export default function AdminTechniciansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [techs, setTechs] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTech, setEditTech] = useState<Technician | null>(null);
  const [form, setForm] = useState({ id: "", name: "", role: "technician", userCode: "", specializations: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/admin/technicians`);
      if (res.ok) setTechs(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const openCreate = () => {
    setEditTech(null);
    setForm({ id: "", name: "", role: "technician", userCode: "", specializations: "" });
    setModalVisible(true);
  };

  const openEdit = (t: Technician) => {
    setEditTech(t);
    setForm({ id: t.id, name: t.name, role: t.role, userCode: t.userCode, specializations: (t.specializations ?? []).join(", ") });
    setModalVisible(true);
  };

  const save = async () => {
    if (!form.name.trim()) { Alert.alert("Validation", "Name is required."); return; }
    setSaving(true);
    try {
      const url = editTech ? `${BASE}/admin/technicians/${editTech.id}` : `${BASE}/admin/technicians`;
      const method = editTech ? "PATCH" : "POST";
      const specs = form.specializations.split(",").map(s => s.trim()).filter(Boolean);
      const body = editTech
        ? { name: form.name, role: form.role, specializations: specs }
        : { id: form.id || undefined, name: form.name, role: form.role, userCode: form.userCode, specializations: specs };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); Alert.alert("Error", e.error ?? "Failed to save."); return; }
      setModalVisible(false);
      load();
    } catch { Alert.alert("Error", "Network error."); } finally { setSaving(false); }
  };

  const deleteTech = (t: Technician) => {
    Alert.alert("Delete Technician", `Delete "${t.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await fetch(`${BASE}/admin/technicians/${t.id}`, { method: "DELETE" }); load(); } catch { /* ignore */ }
      }},
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Technicians" subtitle={`${techs.length} registered`} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Pressable style={[styles.addBtn, { backgroundColor: "#dc2626" }]} onPress={openCreate}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Technician</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
        ) : techs.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No technicians found.</Text>
        ) : (
          techs.map((t) => (
            <View key={t.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: "#ede9fe" }]}>
                  <Text style={[styles.avatarText, { color: "#7c3aed" }]}>{t.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.techName, { color: colors.foreground }]}>{t.name}</Text>
                  <Text style={[styles.techCode, { color: colors.mutedForeground }]}>Code: {t.userCode}</Text>
                  {t.specializations && t.specializations.length > 0 && (
                    <Text style={[styles.techSpecs, { color: colors.mutedForeground }]}>
                      {t.specializations.join(", ")}
                    </Text>
                  )}
                </View>
                <RoleBadge role={t.role} />
              </View>
              <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                <Pressable style={styles.actionBtn} onPress={() => openEdit(t)}>
                  <Feather name="edit-2" size={14} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => deleteTech(t)}>
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                  <Text style={[styles.actionText, { color: colors.destructive }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editTech ? "Edit Technician" : "New Technician"}
            </Text>
            <Pressable onPress={() => setModalVisible(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            {!editTech && (
              <View>
                <Text style={[styles.label, { color: colors.foreground }]}>User Code</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  value={form.userCode} onChangeText={t => setForm(f => ({ ...f, userCode: t }))}
                  placeholder="e.g. MR5678" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters"
                />
              </View>
            )}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))}
                placeholder="Full name" placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Role</Text>
              <View style={styles.roleRow}>
                {TECH_ROLES.map(r => (
                  <Pressable
                    key={r}
                    onPress={() => setForm(f => ({ ...f, role: r }))}
                    style={[styles.roleChip, {
                      backgroundColor: form.role === r ? "#dc2626" : colors.card,
                      borderColor: form.role === r ? "#dc2626" : colors.border,
                    }]}
                  >
                    <Text style={{ color: form.role === r ? "#fff" : colors.foreground, fontSize: 12 }}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Specializations (comma-separated)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={form.specializations} onChangeText={t => setForm(f => ({ ...f, specializations: t }))}
                placeholder="e.g. Engine, Brakes, Electrical" placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: "#dc2626", opacity: saving ? 0.7 : 1 }]}
              onPress={save} disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, marginBottom: 14 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  techName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  techCode: { fontSize: 12, fontFamily: "Inter_500Medium" },
  techSpecs: { fontSize: 11, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  cardActions: { flexDirection: "row", borderTopWidth: 1, padding: 8, gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 6, borderRadius: 6 },
  actionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  saveBtn: { paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
