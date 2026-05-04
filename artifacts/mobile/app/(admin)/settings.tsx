import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

interface AdminSettings {
  mobileCredentials: { code: string; role: string }[];
  yardRoles: string[];
  dmsRoles: string[];
  dbInfo: { tables: number; users: number; technicians: number; vehicles: number };
}

function Section({ title, icon, children, colors }: { title: string; icon: React.ComponentProps<typeof Feather>["name"]; children: React.ReactNode; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <Feather name={icon} size={15} color="#dc2626" />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, colors }: { label: string; value: string | number; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export default function AdminSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/admin/settings`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="System Settings" subtitle="Configuration & credentials" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color="#dc2626" style={{ marginTop: 40 }} />
        ) : !data ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>Unable to load settings.</Text>
        ) : (
          <>
            <Section title="System Info" icon="server" colors={colors}>
              <Row label="Total Users" value={data.dbInfo.users} colors={colors} />
              <Row label="Technicians" value={data.dbInfo.technicians} colors={colors} />
              <Row label="Vehicles" value={data.dbInfo.vehicles} colors={colors} />
            </Section>

            <Section title="Yard Roles" icon="shield" colors={colors}>
              {data.yardRoles.map(r => (
                <View key={r} style={[styles.chipRow, { borderBottomColor: colors.border }]}>
                  <Feather name="check-circle" size={13} color="#16a34a" />
                  <Text style={[styles.chipText, { color: colors.foreground }]}>{r.replace(/_/g, " ")}</Text>
                </View>
              ))}
            </Section>

            <Section title="DMS Mobile Roles" icon="smartphone" colors={colors}>
              {data.dmsRoles.map(r => (
                <View key={r} style={[styles.chipRow, { borderBottomColor: colors.border }]}>
                  <Feather name="check-circle" size={13} color="#1d4ed8" />
                  <Text style={[styles.chipText, { color: colors.foreground }]}>{r}</Text>
                </View>
              ))}
            </Section>

            <Section title="Mobile Login Credentials" icon="key" colors={colors}>
              <Text style={[styles.note, { color: colors.mutedForeground }]}>
                These codes are used by DMS mobile users to log in. Format: Letters + 4-digit PIN.
              </Text>
              {data.mobileCredentials.map(c => (
                <View key={c.code} style={[styles.credRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.codeChip, { backgroundColor: "#f1f5f9" }]}>
                    <Text style={[styles.codeText, { color: "#0f172a" }]}>{c.code}</Text>
                  </View>
                  <Text style={[styles.credRole, { color: colors.mutedForeground }]}>{c.role}</Text>
                </View>
              ))}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 13, fontFamily: "Inter_400Regular", textTransform: "capitalize" },
  note: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 10 },
  credRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  codeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  codeText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  credRole: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
