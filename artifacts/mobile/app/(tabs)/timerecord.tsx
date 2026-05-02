import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { useJobs } from "@/context/JobsContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

function formatTime(iso: string | null) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekStats(records: ReturnType<typeof useJobs>["state"]["timeRecords"]) {
  const now = new Date();
  const week = WEEK_DAYS.map((day, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) + i);
    const dateStr = d.toISOString().split("T")[0];
    const rec = records.find((r) => r.date === dateStr);
    const hours = rec ? rec.totalSeconds / 3600 : 0;
    return { day, date: dateStr, hours: parseFloat(hours.toFixed(1)), isToday: dateStr === now.toISOString().split("T")[0] };
  });
  return week;
}

const NONPROD_TYPES = [
  { key: "Training",       icon: "book-open"   as const },
  { key: "Team Meeting",   icon: "users"        as const },
  { key: "Admin Work",     icon: "file-text"    as const },
  { key: "Workshop Cleaning", icon: "wind"      as const },
];

export default function TimeRecordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, startShift, endShift, startBreak, endBreak, startNonProd, endNonProd } = useJobs();
  const { t } = useLang();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const weekStats = getWeekStats(state.timeRecords);
  const totalWeekSeconds = weekStats.reduce((s, d) => s + d.hours * 3600, 0);
  const maxHours = Math.max(...weekStats.map((d) => d.hours), 8);

  const handleStartShift = () => {
    if (state.activeShift) {
      Alert.alert(t.startShift, "You already have an active shift.");
      return;
    }
    if (Platform.OS === "web") {
      startShift();
      return;
    }
    Alert.alert(t.startShift, "Clock in and start your shift now?", [
      { text: t.cancel, style: "cancel" },
      {
        text: t.startShift,
        onPress: () => {
          startShift();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleEndShift = () => {
    if (Platform.OS === "web") {
      endShift();
      return;
    }
    Alert.alert(t.endShift, "Are you sure you want to clock out?", [
      { text: t.cancel, style: "cancel" },
      {
        text: t.clockOut,
        style: "destructive",
        onPress: () => {
          endShift();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleStartBreak = () => {
    startBreak();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleEndBreak = () => {
    endBreak();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleStartNonProd = (taskType: string) => {
    startNonProd(taskType);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleEndNonProd = () => {
    endNonProd();
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const activeBreak = state.activeBreak;
  const activeNonProd = state.activeNonProd;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title={t.timeRecord} subtitle={t.shiftHistory} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Shift Card */}
        <View style={[styles.shiftCard, { backgroundColor: state.activeShift ? (activeBreak ? "#b45309" : colors.primary) : colors.card, shadowColor: "#000" }]}>
          {state.activeShift ? (
            <>
              <View style={styles.shiftActiveRow}>
                <View style={styles.shiftPulse}>
                  <View style={[styles.shiftDot, { backgroundColor: activeBreak ? "#fbbf24" : "#4ade80" }]} />
                </View>
                <View>
                  <Text style={styles.shiftActiveLabel}>
                    {activeBreak ? (t as any).onBreak ?? "On Break" : t.startShift}
                  </Text>
                  <Text style={styles.shiftStartTime}>
                    {t.clockedIn} {formatTime(state.activeShift.shiftStart)}
                  </Text>
                </View>
              </View>

              <Text style={styles.shiftElapsed}>
                {formatDuration(state.activeShift.totalSeconds)}
              </Text>

              {activeBreak && (
                <Text style={styles.breakSubLabel}>
                  {(t as any).breakDuration ?? "Break Duration"}: {
                    (() => {
                      const last = state.activeShift.breaks[state.activeShift.breaks.length - 1];
                      if (!last) return "0m 00s";
                      const secs = Math.floor((Date.now() - new Date(last.start).getTime()) / 1000);
                      return formatDuration(secs);
                    })()
                  }
                </Text>
              )}

              <View style={styles.shiftBtnRow}>
                {!activeBreak ? (
                  <>
                    <Pressable onPress={handleStartBreak} style={[styles.breakBtn, { backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.3)" }]}>
                      <Feather name="coffee" size={13} color="#fff" />
                      <Text style={styles.breakBtnText}>{(t as any).takeBreak ?? "Take Break"}</Text>
                    </Pressable>
                    <Pressable onPress={handleEndShift} style={styles.endShiftBtn}>
                      <Feather name="square" size={13} color={activeBreak ? "#b45309" : colors.primary} />
                      <Text style={[styles.endShiftBtnText, { color: activeBreak ? "#b45309" : colors.primary }]}>{t.endShift}</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable onPress={handleEndBreak} style={[styles.endBreakBtn]}>
                      <Feather name="play" size={13} color="#16a34a" />
                      <Text style={[styles.endShiftBtnText, { color: "#16a34a" }]}>{(t as any).endBreak ?? "End Break"}</Text>
                    </Pressable>
                    <Pressable onPress={handleEndShift} style={[styles.endShiftBtn, { opacity: 0.7 }]}>
                      <Feather name="square" size={13} color="#b45309" />
                      <Text style={[styles.endShiftBtnText, { color: "#b45309" }]}>{t.endShift}</Text>
                    </Pressable>
                  </>
                )}
              </View>

              {state.activeShift.breaks.length > 0 && (
                <Text style={styles.breaksCount}>
                  {state.activeShift.breaks.length} break{state.activeShift.breaks.length !== 1 ? "s" : ""} taken
                </Text>
              )}
            </>
          ) : (
            <>
              <View style={[styles.shiftIdleIcon, { backgroundColor: colors.accent }]}>
                <Feather name="clock" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.shiftIdleTitle, { color: colors.foreground }]}>{t.clockOut}</Text>
              <Text style={[styles.shiftIdleSubtitle, { color: colors.mutedForeground }]}>
                {t.startShift}
              </Text>
              <Pressable onPress={handleStartShift} style={[styles.startShiftBtn, { backgroundColor: colors.primary }]}>
                <Feather name="play" size={16} color="#fff" />
                <Text style={styles.startShiftBtnText}>{t.startShift}</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Non-Productive Work Card */}
        <View style={[styles.nonprodCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <View style={styles.nonprodHeader}>
            <Feather name="briefcase" size={16} color={colors.mutedForeground} />
            <Text style={[styles.nonprodTitle, { color: colors.foreground }]}>
              {(t as any).nonProductiveWork ?? "Non-Productive Work"}
            </Text>
          </View>

          {activeNonProd ? (
            <View style={[styles.nonprodActive, { backgroundColor: colors.accent, borderColor: colors.primary }]}>
              <View style={styles.nonprodActiveLeft}>
                <View style={[styles.nonprodActiveDot, { backgroundColor: colors.primary }]} />
                <View>
                  <Text style={[styles.nonprodActiveType, { color: colors.primary }]}>{activeNonProd.taskType}</Text>
                  <Text style={[styles.nonprodActiveTimer, { color: colors.foreground }]}>
                    {formatDuration(activeNonProd.elapsedSeconds)}
                  </Text>
                </View>
              </View>
              <Pressable onPress={handleEndNonProd} style={[styles.nonprodEndBtn, { backgroundColor: colors.destructive }]}>
                <Feather name="square" size={12} color="#fff" />
                <Text style={styles.nonprodEndBtnText}>End</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.nonprodGrid}>
              {NONPROD_TYPES.map(({ key, icon }) => (
                <Pressable
                  key={key}
                  onPress={() => handleStartNonProd(key)}
                  style={[styles.nonprodChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                >
                  <Feather name={icon} size={13} color={colors.primary} />
                  <Text style={[styles.nonprodChipText, { color: colors.foreground }]}>{key}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Weekly Bar Chart */}
        <View style={[styles.weekCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
          <View style={styles.weekHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>This Week</Text>
            <Text style={[styles.weekTotal, { color: colors.primary }]}>{formatDuration(totalWeekSeconds)}</Text>
          </View>
          <View style={styles.barChart}>
            {weekStats.map((day) => (
              <View key={day.day} style={styles.barColumn}>
                <Text style={[styles.barValue, { color: colors.mutedForeground }]}>
                  {day.hours > 0 ? `${day.hours}h` : ""}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.min(100, (day.hours / maxHours) * 100)}%`,
                        backgroundColor: day.isToday ? colors.primary : day.hours > 0 ? "#93c5fd" : colors.secondary,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.barLabel,
                    { color: day.isToday ? colors.primary : colors.mutedForeground },
                    day.isToday && { fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {day.day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: "Today", value: state.activeShift ? formatDuration(state.activeShift.totalSeconds) : "0h", icon: "clock" as const, color: colors.primary },
            { label: "This Week", value: `${(totalWeekSeconds / 3600).toFixed(1)}h`, icon: "calendar" as const, color: colors.info },
            { label: "Records", value: `${state.timeRecords.length}`, icon: "list" as const, color: colors.success },
          ].map(({ label, value, icon, color }) => (
            <View key={label} style={[styles.statCard, { backgroundColor: colors.card, shadowColor: "#000" }]}>
              <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
                <Feather name={icon} size={16} color={color} />
              </View>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* History List */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 10 }]}>History</Text>
        {state.timeRecords.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Feather name="clock" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No time records yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>Start your shift to begin recording</Text>
          </View>
        ) : (
          state.timeRecords.map((record) => (
            <Pressable
              key={record.id}
              onPress={() => setExpandedId(expandedId === record.id ? null : record.id)}
              style={[styles.recordCard, { backgroundColor: colors.card, borderColor: record.status === "active" ? colors.primary : colors.border, shadowColor: "#000" }]}
            >
              <View style={styles.recordRow}>
                <View style={[styles.recordIcon, { backgroundColor: record.status === "active" ? colors.primary : colors.secondary }]}>
                  <Feather name="clock" size={14} color={record.status === "active" ? "#fff" : colors.mutedForeground} />
                </View>
                <View style={styles.recordInfo}>
                  <Text style={[styles.recordDate, { color: colors.foreground }]}>
                    {new Date(record.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  </Text>
                  <Text style={[styles.recordMeta, { color: colors.mutedForeground }]}>
                    {formatTime(record.shiftStart)} → {formatTime(record.shiftEnd)}
                    {record.breaks.length > 0 ? `  ·  ${record.breaks.length} break${record.breaks.length !== 1 ? "s" : ""}` : ""}
                  </Text>
                </View>
                <View style={styles.recordRight}>
                  <Text style={[styles.recordHours, { color: colors.foreground }]}>{formatDuration(record.totalSeconds)}</Text>
                  {record.status === "active" && (
                    <View style={[styles.activePill, { backgroundColor: colors.primary }]}>
                      <Text style={styles.activePillText}>Active</Text>
                    </View>
                  )}
                </View>
              </View>
              {expandedId === record.id && record.breaks.length > 0 && (
                <View style={[styles.recordExpanded, { borderTopColor: colors.border }]}>
                  <Text style={[styles.breakTitle, { color: colors.mutedForeground }]}>Breaks</Text>
                  {record.breaks.map((b, i) => (
                    <Text key={i} style={[styles.breakItem, { color: colors.foreground }]}>
                      Break {i + 1}: {formatTime(b.start)} → {formatTime(b.end)}
                    </Text>
                  ))}
                </View>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  shiftCard: { borderRadius: 16, padding: 20, alignItems: "center", gap: 10, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  shiftActiveRow: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "flex-start" },
  shiftPulse: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  shiftDot: { width: 12, height: 12, borderRadius: 6 },
  shiftActiveLabel: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  shiftStartTime: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" },
  shiftElapsed: { color: "#fff", fontSize: 42, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  breakSubLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular" },
  shiftBtnRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  endShiftBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 50 },
  endShiftBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  breakBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 50 },
  breakBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  endBreakBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 50 },
  breaksCount: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_400Regular" },
  shiftIdleIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  shiftIdleTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  shiftIdleSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  startShiftBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 50 },
  startShiftBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  nonprodCard: { borderRadius: 14, padding: 16, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, gap: 12 },
  nonprodHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  nonprodTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nonprodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nonprodChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 50, borderWidth: 1 },
  nonprodChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  nonprodActive: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, borderWidth: 1.5 },
  nonprodActiveLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  nonprodActiveDot: { width: 10, height: 10, borderRadius: 5 },
  nonprodActiveType: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  nonprodActiveTimer: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 1 },
  nonprodEndBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50 },
  nonprodEndBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  weekCard: { borderRadius: 14, padding: 16, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  weekHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  weekTotal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  barChart: { flexDirection: "row", height: 120, alignItems: "flex-end", gap: 8 },
  barColumn: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barValue: { fontSize: 9, fontFamily: "Inter_400Regular", height: 14 },
  barTrack: { flex: 1, width: "100%", backgroundColor: "#f1f5f9", borderRadius: 6, overflow: "hidden", justifyContent: "flex-end" },
  barFill: { width: "100%", borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 6, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  recordCard: { borderRadius: 12, borderWidth: 1.5, marginBottom: 8, overflow: "hidden", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  recordRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  recordIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  recordInfo: { flex: 1 },
  recordDate: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  recordMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  recordRight: { alignItems: "flex-end", gap: 4 },
  recordHours: { fontSize: 15, fontFamily: "Inter_700Bold" },
  activePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  activePillText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  recordExpanded: { borderTopWidth: 1, padding: 14, gap: 4 },
  breakTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  breakItem: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyCard: { borderRadius: 14, padding: 36, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySubtext: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
