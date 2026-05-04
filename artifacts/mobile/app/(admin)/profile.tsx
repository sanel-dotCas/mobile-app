import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function AdminProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userCode, logout } = useAuth();

  const items = [
    { icon: "shield" as const, label: "Role", value: "Administrator" },
    { icon: "key" as const, label: "Access Code", value: userCode },
    { icon: "database" as const, label: "System", value: "IGMMA DMS" },
    { icon: "globe" as const, label: "Version", value: "1.0.0" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 + insets.bottom }}>
        {/* Admin badge */}
        <View style={styles.hero}>
          <View style={[styles.avatarCircle, { backgroundColor: "#fee2e2" }]}>
            <Feather name="shield" size={32} color="#dc2626" />
          </View>
          <Text style={[styles.heroName, { color: colors.foreground }]}>Administrator</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>IGMMA DMS Control Centre</Text>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        </View>

        {/* Info rows */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {items.map((item, i) => (
            <View
              key={item.label}
              style={[styles.row, { borderBottomColor: colors.border }, i === items.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: "#fee2e2" }]}>
                <Feather name={item.icon} size={15} color="#dc2626" />
              </View>
              <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              <Text style={[styles.rowValue, { color: colors.foreground }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Admin capabilities */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Admin Capabilities</Text>
          {[
            "Manage all system users & roles",
            "Add, edit & remove technicians",
            "Monitor vehicles, inspections & jobs",
            "Configure system settings",
            "View all locations & service packages",
            "Full read/write access to master data",
          ].map(cap => (
            <View key={cap} style={styles.capRow}>
              <Feather name="check-circle" size={14} color="#dc2626" />
              <Text style={[styles.capText, { color: colors.foreground }]}>{cap}</Text>
            </View>
          ))}
        </View>

        {/* Sign out */}
        <Pressable
          style={[styles.logoutBtn, { borderColor: colors.border }]}
          onPress={logout}
        >
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: 24, gap: 6 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  heroName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  heroSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  adminBadge: { backgroundColor: "#dc2626", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 4 },
  adminBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.5 },
  section: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  capRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  capText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
