import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useAuth } from "@/context/AuthContext";
import type { Estimate, EstimateStatus } from "@/context/EstimatesContext";
import { useEstimates } from "@/context/EstimatesContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const STATUS_CONFIG: Record<EstimateStatus, { color: string; bg: string; label: string; icon: string }> = {
  pending_inspection:       { color: "#d97706", bg: "#fef3c7", label: "Pending Inspection", icon: "clock" },
  inspection_in_progress:   { color: "#2563eb", bg: "#dbeafe", label: "In Progress",         icon: "activity" },
  review:                   { color: "#7c3aed", bg: "#ede9fe", label: "Under Review",         icon: "eye" },
  approved:                 { color: "#16a34a", bg: "#dcfce7", label: "Approved",              icon: "check-circle" },
  submitted:                { color: "#64748b", bg: "#f1f5f9", label: "Submitted to DMS",     icon: "send" },
};

function EstimateCard({ estimate, onPress }: { estimate: Estimate; onPress: () => void }) {
  const colors = useColors();
  const { t } = useLang();
  const cfg = STATUS_CONFIG[estimate.status];
  const laborTotal = estimate.lines.filter((l) => l.type === "labor").reduce((s, l) => s + l.total, 0);
  const partsTotal = estimate.lines.filter((l) => l.type === "part").reduce((s, l) => s + l.total, 0);
  const materialsTotal = estimate.lines.filter((l) => l.type === "material").reduce((s, l) => s + l.total, 0);
  const grandTotal = laborTotal + partsTotal + materialsTotal;
  const isNew = estimate.status === "pending_inspection";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: isNew ? "#bfdbfe" : colors.border, opacity: pressed ? 0.95 : 1, shadowColor: "#000" },
      ]}
    >
      {isNew && <View style={[styles.newBadgeStripe, { backgroundColor: "#2563eb" }]} />}
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={styles.titleRow}>
            <Text style={[styles.estimateNo, { color: colors.foreground }]}>{estimate.estimateNo}</Text>
            {isNew && (
              <View style={styles.dmsBadge}>
                <Feather name="zap" size={9} color="#2563eb" />
                <Text style={styles.dmsBadgeText}>{t.dmsSent}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.vehicle, { color: colors.foreground }]}>{estimate.vehicle}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {estimate.licensePlate}  ·  {estimate.customer}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon as never} size={10} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={[styles.damageBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="alert-circle" size={12} color={colors.mutedForeground} />
        <Text style={[styles.damageText, { color: colors.mutedForeground }]} numberOfLines={2}>
          {estimate.damageNotes}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[styles.advisorText, { color: colors.mutedForeground }]}>{estimate.serviceAdvisor}</Text>
        </View>
        {grandTotal > 0 ? (
          <Text style={[styles.totalText, { color: colors.foreground }]}>
            ${grandTotal.toFixed(2)}
          </Text>
        ) : (
          <View style={[styles.beginBtn, { backgroundColor: "#2563eb" }]}>
            <Feather name="camera" size={11} color="#fff" />
            <Text style={styles.beginBtnText}>{t.beginInspection}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function EstimatorIndexScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useEstimates();
  const { logout, userCode } = useAuth();
  const { t } = useLang();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [filter, setFilter] = useState<EstimateStatus | "all">("all");

  const filtered = filter === "all"
    ? state.estimates
    : state.estimates.filter((e) => e.status === filter);

  const pendingCount = state.estimates.filter((e) => e.status === "pending_inspection").length;

  const filterOptions: Array<{ key: EstimateStatus | "all"; label: string }> = [
    { key: "all",                   label: t.all },
    { key: "pending_inspection",    label: t.pendingInspection },
    { key: "inspection_in_progress",label: t.inProgress },
    { key: "approved",              label: t.completed },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t.estimates}
        subtitle={`${t.estimator} · ${userCode}`}
        rightElement={
          <View style={styles.headerRight}>
            <LanguagePicker />
            <Pressable onPress={logout} style={[styles.logoutBtn, { borderColor: colors.border }]}>
              <Feather name="log-out" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>
        }
      />

      {pendingCount > 0 && (
        <View style={[styles.alertBanner, { backgroundColor: "#eff6ff", borderBottomColor: "#bfdbfe" }]}>
          <View style={[styles.alertIcon, { backgroundColor: "#bfdbfe" }]}>
            <Feather name="zap" size={13} color="#2563eb" />
          </View>
          <Text style={styles.alertText}>
            {pendingCount} estimate{pendingCount !== 1 ? "s" : ""} received from DMS — {t.beginInspection.toLowerCase()}
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.filterContent}
      >
        {filterOptions.map(({ key, label }) => {
          const active = filter === key;
          const count = key === "all" ? state.estimates.length : state.estimates.filter((e) => e.status === key).length;
          return (
            <Pressable
              key={key}
              onPress={() => { setFilter(key); Haptics.selectionAsync(); }}
              style={[styles.filterTab, active && { borderBottomColor: colors.primary }]}
            >
              <Text style={[styles.filterLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
                {label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: active ? colors.primary : colors.secondary }]}>
                  <Text style={[styles.filterBadgeText, { color: active ? "#fff" : colors.mutedForeground }]}>
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="file-text" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t.noJobs}</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Estimates assigned to you from the DMS will appear here.
            </Text>
          </View>
        ) : (
          filtered.map((est) => (
            <EstimateCard
              key={est.id}
              estimate={est}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/estimate/${est.id}`);
              }}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1 },
  headerRight:    { flexDirection: "row", alignItems: "center", gap: 8 },
  logoutBtn:      { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },

  alertBanner:    { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  alertIcon:      { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  alertText:      { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#2563eb" },

  filterBar:      { borderBottomWidth: 1, flexGrow: 0 },
  filterContent:  { paddingHorizontal: 12, gap: 2 },
  filterTab:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 11, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  filterLabel:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  filterBadge:    { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  filterBadgeText:{ fontSize: 10, fontFamily: "Inter_700Bold" },

  scroll:         { flex: 1 },
  content:        { padding: 16, gap: 12 },

  empty:          { alignItems: "center", paddingVertical: 64, gap: 10 },
  emptyTitle:     { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText:      { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260 },

  card:           { borderRadius: 16, borderWidth: 1.5, overflow: "hidden", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  newBadgeStripe: { height: 3 },
  cardHeader:     { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14, paddingBottom: 10 },
  cardLeft:       { flex: 1, gap: 3, paddingRight: 8 },
  titleRow:       { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  estimateNo:     { fontSize: 15, fontFamily: "Inter_700Bold" },
  dmsBadge:       { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#dbeafe", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  dmsBadgeText:   { fontSize: 9, fontFamily: "Inter_700Bold", color: "#2563eb" },
  vehicle:        { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  meta:           { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusPill:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignSelf: "flex-start" },
  statusText:     { fontSize: 10, fontFamily: "Inter_700Bold" },

  damageBox:      { flexDirection: "row", alignItems: "flex-start", gap: 7, marginHorizontal: 14, marginBottom: 12, padding: 10, borderRadius: 10, borderWidth: 1 },
  damageText:     { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },

  cardFooter:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  footerLeft:     { flexDirection: "row", alignItems: "center", gap: 5 },
  advisorText:    { fontSize: 11, fontFamily: "Inter_400Regular" },
  totalText:      { fontSize: 15, fontFamily: "Inter_700Bold", color: "#2563eb" },
  beginBtn:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  beginBtnText:   { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
