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

type YardUser = {
  id: number; name: string; username: string; role: string;
  locationId: number | null; notificationsEnabled: boolean; createdAt: string;
};

const ROLES = ["admin", "yard_manager", "yard_operator"];

const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  admin: { bg: "#fee2e2", text: "#dc2626" },
  yard_manager: { bg: "#dbeafe", text: "#1d4ed8" },
  yard_operator: { bg: "#dcfce7", text: "#16a34a" },
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLOR[role] ?? { bg: "#f1f5f9", text: "#64748b" };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{role.replace(/_/g, " ")}</Text>
    </View>
  );
}

export default function AdminUsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<YardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUser, setEditUser] = useState<YardUser | null>(null);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "yard_operator" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/admin/users`);
      if (res.ok) setUsers(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: "", username: "", password: "", role: "yard_operator" });
    setModalVisible(true);
  };

  const openEdit = (u: YardUser) => {
    setEditUser(u);
    setForm({ name: u.name, username: u.username, password: "", role: u.role });
    setModalVisible(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.username.trim()) {
      Alert.alert("Validation", "Name and username are required.");
      return;
    }
    setSaving(true);
    try {
      const url = editUser ? `${BASE}/admin/users/${editUser.id}` : `${BASE}/admin/users`;
      const method = editUser ? "PATCH" : "POST";
      const body = editUser
        ? { name: form.name, role: form.role }
        : { name: form.name, username: form.username, password: form.password || "changeme", role: form.role };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json();
        Alert.alert("Error", e.error ?? "Failed to save user.");
        return;
      }
      setModalVisible(false);
      load();
    } catch {
      Alert.alert("Error", "Network error.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = (u: YardUser) => {
    Alert.alert("Delete User", `Delete "${u.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${BASE}/admin/users/${u.id}`, { method: "DELETE" });
            load();
          } catch { /* ignore */ }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Yard Users" subtitle={`${users.length} accounts`} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Pressable style={[styles.addBtn, { backgroundColor: "#dc2626" }]} onPress={openCreate}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add User</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
        ) : users.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>No users found.</Text>
        ) : (
          users.map((u) => (
            <View key={u.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: "#fee2e2" }]}>
                  <Text style={[styles.avatarText, { color: "#dc2626" }]}>{u.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{u.name}</Text>
                  <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>@{u.username}</Text>
                </View>
                <RoleBadge role={u.role} />
              </View>
              <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                <Pressable style={styles.actionBtn} onPress={() => openEdit(u)}>
                  <Feather name="edit-2" size={14} color={colors.primary} />
                  <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => deleteUser(u)}>
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
              {editUser ? "Edit User" : "New User"}
            </Text>
            <Pressable onPress={() => setModalVisible(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))}
                placeholder="Full name" placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {!editUser && (
              <>
                <View>
                  <Text style={[styles.label, { color: colors.foreground }]}>Username</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                    value={form.username} onChangeText={t => setForm(f => ({ ...f, username: t }))}
                    placeholder="username" placeholderTextColor={colors.mutedForeground} autoCapitalize="none"
                  />
                </View>
                <View>
                  <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                    value={form.password} onChangeText={t => setForm(f => ({ ...f, password: t }))}
                    placeholder="Leave blank for 'changeme'" placeholderTextColor={colors.mutedForeground}
                    secureTextEntry
                  />
                </View>
              </>
            )}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Role</Text>
              <View style={styles.roleRow}>
                {ROLES.map(r => (
                  <Pressable
                    key={r}
                    onPress={() => setForm(f => ({ ...f, role: r }))}
                    style={[styles.roleChip, {
                      backgroundColor: form.role === r ? "#dc2626" : colors.card,
                      borderColor: form.role === r ? "#dc2626" : colors.border,
                    }]}
                  >
                    <Text style={{ color: form.role === r ? "#fff" : colors.foreground, fontSize: 12 }}>
                      {r.replace(/_/g, " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
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
