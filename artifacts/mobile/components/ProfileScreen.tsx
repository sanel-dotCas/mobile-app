import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { LanguagePicker } from "@/components/LanguagePicker";
import { MOBILE_SESSION_KEY, useAuth } from "@/context/AuthContext";
import { useEfficiencyThresholds } from "@/context/EfficiencyThresholdsContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

const NOTIF_PREF_KEY = "yard_notifications_enabled";

type ProfileTab = "info" | "leave" | "settings";
type LeaveStatus = "pending" | "approved" | "rejected";

const LEAVE_TYPES = [
  "Annual Leave",
  "Sick Leave",
  "Emergency Leave",
  "Unpaid Leave",
  "Study Leave",
] as const;
type LeaveType = (typeof LEAVE_TYPES)[number];

const APPROVERS = ["Sarah Mitchell", "Adam Davis"] as const;
type Approver = (typeof APPROVERS)[number];

interface LeaveRequest {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  approver: Approver;
  notes: string;
  createdAt: string;
  status: LeaveStatus;
}

const USER_PROFILES: Record<string, {
  name: string;
  employeeId: string;
  department: string;
  email: string;
  phone: string;
  startDate: string;
  avatarColor: string;
}> = {
  MR: { name: "Michael Richards", employeeId: "EMP-001", department: "Body Shop",  email: "m.richards@igmma.com", phone: "+47 900 12 345", startDate: "15 Mar 2021", avatarColor: "#2563eb" },
  JW: { name: "James Wilson",     employeeId: "EMP-002", department: "Mechanical", email: "j.wilson@igmma.com",   phone: "+47 900 23 456", startDate: "01 Jul 2020", avatarColor: "#7c3aed" },
  SV: { name: "Sarah Mitchell",   employeeId: "EMP-010", department: "Management", email: "s.mitchell@igmma.com", phone: "+47 900 34 567", startDate: "10 Jan 2019", avatarColor: "#16a34a" },
  AD: { name: "Adam Davis",       employeeId: "EMP-011", department: "Management", email: "a.davis@igmma.com",   phone: "+47 900 45 678", startDate: "20 Jun 2018", avatarColor: "#dc2626" },
  ET: { name: "Emily Torres",     employeeId: "EMP-020", department: "Estimating", email: "e.torres@igmma.com",  phone: "+47 900 56 789", startDate: "14 Feb 2022", avatarColor: "#d97706" },
  PT: { name: "Peter Thompson",   employeeId: "EMP-030", department: "Parts",      email: "p.thompson@igmma.com", phone: "+47 900 67 890", startDate: "05 Sep 2020", avatarColor: "#7c3aed" },
  PD: { name: "Paula Davies",     employeeId: "EMP-031", department: "Parts",      email: "p.davies@igmma.com",   phone: "+47 900 78 901", startDate: "22 Nov 2021", avatarColor: "#6d28d9" },
};

const ROLE_LABEL: Record<string, string> = {
  technician: "Technician",
  supervisor: "Supervisor",
  estimator:  "Estimator",
  parts:      "Parts",
};
const ROLE_COLOR: Record<string, string> = {
  technician: "#2563eb",
  supervisor: "#16a34a",
  estimator:  "#d97706",
  parts:      "#7c3aed",
};

const LEAVE_STATUS_CONFIG: Record<LeaveStatus, { color: string; bg: string; label: string }> = {
  pending:  { color: "#d97706", bg: "#fef3c7", label: "Pending"  },
  approved: { color: "#16a34a", bg: "#dcfce7", label: "Approved" },
  rejected: { color: "#dc2626", bg: "#fee2e2", label: "Rejected" },
};

const SEED_LEAVE: LeaveRequest[] = [
  {
    id: "lr-001", type: "Annual Leave",
    startDate: "10 Jun 2026", endDate: "14 Jun 2026", numberOfDays: 5,
    approver: "Sarah Mitchell", notes: "Summer holiday",
    createdAt: "28 Apr 2026", status: "approved",
  },
  {
    id: "lr-002", type: "Sick Leave",
    startDate: "02 May 2026", endDate: "03 May 2026", numberOfDays: 2,
    approver: "Sarah Mitchell", notes: "",
    createdAt: "02 May 2026", status: "pending",
  },
];

function PickerSheet({
  visible, title, options, selected, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ss.pickerOverlay} onPress={onClose}>
        <Pressable style={[ss.pickerSheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation?.()}>
          <View style={[ss.pickerHandle, { backgroundColor: colors.border }]} />
          <Text style={[ss.pickerTitle, { color: colors.foreground }]}>{title}</Text>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => { onSelect(opt); onClose(); }}
              style={({ pressed }) => [
                ss.pickerOption,
                { borderBottomColor: colors.border, backgroundColor: selected === opt ? colors.primary + "15" : "transparent", opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[ss.pickerOptionText, { color: selected === opt ? colors.primary : colors.foreground }]}>{opt}</Text>
              {selected === opt && <Feather name="check" size={16} color={colors.primary} />}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function calcDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  return Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
}

function fmtDate(d: string): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ProfileScreen() {
  const { userCode, role, logout } = useAuth();
  const { t } = useLang();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;
  const { thresholds, setThresholds } = useEfficiencyThresholds();

  const profile = USER_PROFILES[userCode] ?? USER_PROFILES.MR;
  const initials = profile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const [greenInput, setGreenInput] = useState(String(thresholds.greenMin));
  const [amberInput, setAmberInput] = useState(String(thresholds.amberMin));
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [thresholdSaved, setThresholdSaved] = useState(false);

  useEffect(() => {
    setGreenInput(String(thresholds.greenMin));
    setAmberInput(String(thresholds.amberMin));
  }, [thresholds.greenMin, thresholds.amberMin]);

  const handleSaveThresholds = useCallback(async () => {
    const green = parseInt(greenInput, 10);
    const amber = parseInt(amberInput, 10);
    if (isNaN(green) || isNaN(amber) || green < 1 || green > 100 || amber < 1 || amber > 100) {
      setThresholdError("Both values must be between 1 and 100.");
      setThresholdSaved(false);
      return;
    }
    if (amber >= green) {
      setThresholdError("Green threshold must be higher than amber.");
      setThresholdSaved(false);
      return;
    }
    setThresholdError(null);
    await setThresholds({ greenMin: green, amberMin: amber });
    setThresholdSaved(true);
    setTimeout(() => setThresholdSaved(false), 3000);
  }, [greenInput, amberInput, setThresholds]);

  const [activeTab, setActiveTab] = useState<ProfileTab>("info");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [togglingNotifs, setTogglingNotifs] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_PREF_KEY).then((v) => {
      if (v !== null) setNotificationsEnabled(v === "true");
    });
  }, []);

  const handleToggleNotifications = useCallback(
    async (value: boolean) => {
      if (togglingNotifs) return;
      setTogglingNotifs(true);
      // Optimistic update
      setNotificationsEnabled(value);
      await AsyncStorage.setItem(NOTIF_PREF_KEY, String(value));
      try {
        const sessionToken = await AsyncStorage.getItem(MOBILE_SESSION_KEY);
        if (sessionToken) {
          const res = await fetch(`${BASE}/yard/auth/notifications-enabled`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-mobile-session": sessionToken,
            },
            body: JSON.stringify({ enabled: value }),
          });
          if (!res.ok) throw new Error("API error");
        }
      } catch {
        // Rollback both local state and persisted preference on failure
        setNotificationsEnabled(!value);
        await AsyncStorage.setItem(NOTIF_PREF_KEY, String(!value));
      } finally {
        setTogglingNotifs(false);
      }
    },
    [togglingNotifs]
  );

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(SEED_LEAVE);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showApproverPicker, setShowApproverPicker] = useState(false);

  const [fType, setFType] = useState<LeaveType>("Annual Leave");
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fApprover, setFApprover] = useState<Approver>("Sarah Mitchell");
  const [fNotes, setFNotes] = useState("");

  const resetForm = () => {
    setFType("Annual Leave"); setFStart(""); setFEnd("");
    setFApprover("Sarah Mitchell"); setFNotes("");
  };

  const handleSubmit = useCallback(() => {
    if (!fStart || !fEnd) {
      Alert.alert("Missing dates", "Please enter both start and end dates.");
      return;
    }
    const days = calcDays(fStart, fEnd);
    if (days < 1) {
      Alert.alert("Invalid dates", "End date must be on or after start date.");
      return;
    }
    setLeaveRequests((prev) => [{
      id: `lr-${Date.now()}`,
      type: fType,
      startDate: fmtDate(fStart),
      endDate: fmtDate(fEnd),
      numberOfDays: days,
      approver: fApprover,
      notes: fNotes.trim(),
      createdAt: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: "pending",
    }, ...prev]);
    setShowRequestModal(false);
    resetForm();
  }, [fType, fStart, fEnd, fApprover, fNotes]);

  const approvedAnnual = leaveRequests
    .filter((r) => r.type === "Annual Leave" && r.status === "approved")
    .reduce((s, r) => s + r.numberOfDays, 0);
  const approvedSick = leaveRequests
    .filter((r) => r.type === "Sick Leave" && r.status === "approved")
    .reduce((s, r) => s + r.numberOfDays, 0);
  const approvedEmergency = leaveRequests
    .filter((r) => r.type === "Emergency Leave" && r.status === "approved")
    .reduce((s, r) => s + r.numberOfDays, 0);

  const TAB_OPTIONS: { key: ProfileTab; labelKey: keyof typeof t; icon: string }[] = [
    { key: "info",     labelKey: "userInformation", icon: "user"     },
    { key: "leave",    labelKey: "leaveRequests",   icon: "calendar" },
    { key: "settings", labelKey: "settings",        icon: "settings" },
  ];

  const daysPreview = fStart && fEnd ? calcDays(fStart, fEnd) : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title={t.profile} rightElement={<LanguagePicker />} />

      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.heroInfo}>
          <Text style={[styles.heroName, { color: colors.foreground }]}>{profile.name}</Text>
          <View style={styles.heroRow}>
            <View style={[styles.roleBadge, { backgroundColor: ROLE_COLOR[role] + "22" }]}>
              <Text style={[styles.roleBadgeText, { color: ROLE_COLOR[role] }]}>{ROLE_LABEL[role]}</Text>
            </View>
            <Text style={[styles.heroCode, { color: colors.mutedForeground }]}>· {userCode}</Text>
          </View>
          <Text style={[styles.heroDept, { color: colors.mutedForeground }]}>{profile.department}</Text>
        </View>
      </View>

      {/* Segment bar */}
      <View style={[styles.segBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {TAB_OPTIONS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.segBtn, active && [styles.segBtnActive, { borderBottomColor: colors.primary }]]}
            >
              <Feather name={tab.icon as any} size={12} color={active ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.segBtnText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {t[tab.labelKey] as string}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── USER INFORMATION ── */}
        {activeTab === "info" && (
          <View style={{ gap: 14 }}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t.userInformation}</Text>
              {[
                { icon: "hash",      label: t.employeeId, value: profile.employeeId },
                { icon: "briefcase", label: t.department, value: profile.department },
                { icon: "calendar",  label: t.startDate,  value: profile.startDate  },
                { icon: "mail",      label: "Email",      value: profile.email      },
                { icon: "phone",     label: "Phone",      value: profile.phone      },
              ].map(({ icon, label, value }) => (
                <View key={label} style={[styles.infoRow, { borderTopColor: colors.border }]}>
                  <Feather name={icon as any} size={13} color={colors.mutedForeground} />
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            </View>

            {/* Leave balance */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Leave Balance</Text>
              {[
                { label: "Annual",    total: 25, used: approvedAnnual,    color: "#2563eb" },
                { label: "Sick",      total: 15, used: approvedSick,      color: "#dc2626" },
                { label: "Emergency", total: 3,  used: approvedEmergency, color: "#d97706" },
              ].map(({ label, total, used, color }) => (
                <View key={label} style={[styles.balanceRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.balanceLabel, { color: colors.foreground }]}>{label}</Text>
                  <View style={[styles.balanceBarBg, { backgroundColor: color + "22" }]}>
                    <View style={[styles.balanceBarFill, { backgroundColor: color, width: `${Math.min((used / total) * 100, 100)}%` as any }]} />
                  </View>
                  <Text style={[styles.balanceDays, { color: colors.mutedForeground }]}>
                    {total - used}<Text style={{ color: color }}>/{total}</Text>d
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={logout}
              style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Feather name="log-out" size={15} color="#dc2626" />
              <Text style={styles.logoutBtnText}>{t.logout}</Text>
            </Pressable>
          </View>
        )}

        {/* ── LEAVE REQUESTS ── */}
        {activeTab === "leave" && (
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => setShowRequestModal(true)}
              style={({ pressed }) => [styles.requestBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="plus" size={15} color="#fff" />
              <Text style={styles.requestBtnText}>{t.requestLeave}</Text>
            </Pressable>

            {leaveRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="calendar" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t.noLeaveRequests}</Text>
              </View>
            ) : leaveRequests.map((lr) => {
              const sc = LEAVE_STATUS_CONFIG[lr.status];
              return (
                <View key={lr.id} style={[styles.leaveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.leaveCardTop}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.leaveType, { color: colors.foreground }]}>{lr.type}</Text>
                      <Text style={[styles.leaveDates, { color: colors.mutedForeground }]}>
                        {lr.startDate} → {lr.endDate}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: sc.color }]} />
                      <Text style={[styles.statusBadgeText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                  </View>
                  <View style={[styles.leaveMeta, { borderTopColor: colors.border }]}>
                    <Text style={[styles.leaveMetaChip, { backgroundColor: colors.secondary, color: colors.foreground }]}>
                      {lr.numberOfDays} {t.numberOfDays}
                    </Text>
                    <Text style={[styles.leaveMetaChip, { backgroundColor: colors.secondary, color: colors.mutedForeground }]}>
                      {t.approver}: {lr.approver.split(" ").pop()}
                    </Text>
                    <Text style={[styles.leaveMetaChip, { backgroundColor: colors.secondary, color: colors.mutedForeground }]}>
                      {lr.createdAt}
                    </Text>
                  </View>
                  {!!lr.notes && (
                    <Text style={[styles.leaveNotes, { color: colors.mutedForeground, borderTopColor: colors.border }]} numberOfLines={2}>
                      {lr.notes}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === "settings" && (
          <View style={{ gap: 14 }}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t.settings}</Text>
              <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
                <Feather name="globe" size={15} color={colors.mutedForeground} />
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{t.appLanguage}</Text>
                <LanguagePicker />
              </View>
              <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
                <Feather name="bell" size={15} color={notificationsEnabled ? colors.primary : colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>{t.notifications}</Text>
                  {Platform.OS !== "web" && (
                    <Text style={[{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }]}>
                      {notificationsEnabled ? "Push alerts for new inspections" : "Notifications disabled"}
                    </Text>
                  )}
                  {Platform.OS === "web" && (
                    <Text style={[{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }]}>
                      Push notifications require the mobile app
                    </Text>
                  )}
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleToggleNotifications}
                  disabled={togglingNotifs || Platform.OS === "web"}
                  trackColor={{ false: colors.border, true: colors.primary + "88" }}
                  thumbColor={notificationsEnabled ? colors.primary : colors.mutedForeground}
                />
              </View>
              <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
                <Feather name="moon" size={15} color={colors.mutedForeground} />
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{t.darkMode}</Text>
                <View style={[styles.comingSoon, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.comingSoonText, { color: colors.mutedForeground }]}>Coming soon</Text>
                </View>
              </View>
            </View>

            {/* ── EFFICIENCY THRESHOLDS (supervisors only) ── */}
            {role === "supervisor" && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={ss.thresholdHeader}>
                  <Feather name="trending-up" size={15} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 0, flex: 1 }]}>
                    Efficiency Thresholds
                  </Text>
                </View>
                <Text style={[ss.thresholdSubtitle, { color: colors.mutedForeground }]}>
                  Colour-code technician efficiency on the floor view and team screen.
                </Text>

                <View style={[ss.thresholdRow, { borderTopColor: colors.border }]}>
                  <View style={[ss.thresholdDot, { backgroundColor: "#16a34a" }]} />
                  <Text style={[ss.thresholdLabel, { color: colors.foreground }]}>Green ≥</Text>
                  <TextInput
                    style={[ss.thresholdInput, { borderColor: colors.border, backgroundColor: colors.secondary, color: colors.foreground }]}
                    keyboardType="number-pad"
                    maxLength={3}
                    value={greenInput}
                    onChangeText={(v) => { setGreenInput(v.replace(/[^0-9]/g, "")); setThresholdError(null); }}
                    returnKeyType="done"
                  />
                  <Text style={[ss.thresholdUnit, { color: colors.mutedForeground }]}>%</Text>
                </View>

                <View style={[ss.thresholdRow, { borderTopColor: colors.border }]}>
                  <View style={[ss.thresholdDot, { backgroundColor: "#d97706" }]} />
                  <Text style={[ss.thresholdLabel, { color: colors.foreground }]}>Amber ≥</Text>
                  <TextInput
                    style={[ss.thresholdInput, { borderColor: colors.border, backgroundColor: colors.secondary, color: colors.foreground }]}
                    keyboardType="number-pad"
                    maxLength={3}
                    value={amberInput}
                    onChangeText={(v) => { setAmberInput(v.replace(/[^0-9]/g, "")); setThresholdError(null); }}
                    returnKeyType="done"
                  />
                  <Text style={[ss.thresholdUnit, { color: colors.mutedForeground }]}>%</Text>
                </View>

                <View style={[ss.thresholdRow, { borderTopColor: colors.border }]}>
                  <View style={[ss.thresholdDot, { backgroundColor: "#dc2626" }]} />
                  <Text style={[ss.thresholdLabel, { color: colors.mutedForeground }]}>
                    Red &lt; {amberInput || "—"}%
                  </Text>
                </View>

                {thresholdError && (
                  <Text style={[ss.thresholdError, { color: "#dc2626" }]}>{thresholdError}</Text>
                )}

                {thresholdSaved && (
                  <View style={[ss.thresholdSuccess, { backgroundColor: "#dcfce7", borderColor: "#86efac" }]}>
                    <Feather name="check-circle" size={13} color="#16a34a" />
                    <Text style={[ss.thresholdSuccessText, { color: "#16a34a" }]}>
                      Thresholds saved — Green ≥ {greenInput}%, Amber ≥ {amberInput}%, Red &lt; {amberInput}%
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={handleSaveThresholds}
                  style={({ pressed }) => [ss.thresholdSaveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={ss.thresholdSaveBtnText}>Save Thresholds</Text>
                </Pressable>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>App Info</Text>
              {[
                { label: "Version",     value: "1.0.0" },
                { label: "DMS",         value: "IGMMA" },
                { label: "Environment", value: "Production" },
              ].map(({ label, value }) => (
                <View key={label} style={[styles.infoRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── REQUEST LEAVE MODAL ── */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowRequestModal(false); resetForm(); }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { setShowRequestModal(false); resetForm(); }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
            <Pressable
              style={[styles.modalSheet, { backgroundColor: colors.card, paddingBottom: (Platform.OS === "web" ? 24 : insets.bottom) + 16 }]}
              onPress={(e) => e.stopPropagation?.()}
            >
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create Leave Request</Text>
                <Pressable onPress={() => { setShowRequestModal(false); resetForm(); }} hitSlop={10}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
                <View style={{ gap: 12, paddingBottom: 8 }}>
                  {/* Type */}
                  <View>
                    <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{t.leaveType}</Text>
                    <Pressable
                      onPress={() => setShowTypePicker(true)}
                      style={[styles.selectBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
                    >
                      <Text style={[styles.selectBtnText, { color: colors.foreground }]}>{fType}</Text>
                      <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                    </Pressable>
                  </View>

                  {/* Dates */}
                  <View style={styles.datesRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{t.leaveStart}</Text>
                      <TextInput
                        value={fStart}
                        onChangeText={setFStart}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.mutedForeground}
                        style={[styles.formInput, { borderColor: colors.border, backgroundColor: colors.secondary, color: colors.foreground }]}
                        {...(Platform.OS === "web" ? { type: "date" } as any : {})}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{t.leaveEnd}</Text>
                      <TextInput
                        value={fEnd}
                        onChangeText={setFEnd}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.mutedForeground}
                        style={[styles.formInput, { borderColor: colors.border, backgroundColor: colors.secondary, color: colors.foreground }]}
                        {...(Platform.OS === "web" ? { type: "date" } as any : {})}
                      />
                    </View>
                  </View>

                  {/* Approver */}
                  <View>
                    <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{t.approver}</Text>
                    <Pressable
                      onPress={() => setShowApproverPicker(true)}
                      style={[styles.selectBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
                    >
                      <Text style={[styles.selectBtnText, { color: colors.foreground }]}>{fApprover}</Text>
                      <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                    </Pressable>
                  </View>

                  {/* Notes */}
                  <View>
                    <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{t.notes}</Text>
                    <TextInput
                      value={fNotes}
                      onChangeText={setFNotes}
                      placeholder="Optional notes..."
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      numberOfLines={3}
                      style={[styles.formInput, styles.formTextarea, { borderColor: colors.border, backgroundColor: colors.secondary, color: colors.foreground }]}
                    />
                  </View>

                  {/* Days preview */}
                  {daysPreview > 0 && (
                    <View style={[styles.daysPreview, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                      <Feather name="sun" size={13} color="#2563eb" />
                      <Text style={styles.daysPreviewText}>{daysPreview} {t.numberOfDays}</Text>
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={styles.modalBtns}>
                    <Pressable
                      onPress={() => { setShowRequestModal(false); resetForm(); }}
                      style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>{t.cancel}</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSubmit}
                      style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Text style={styles.saveBtnText}>{t.save}</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <PickerSheet
        visible={showTypePicker}
        title={t.leaveType}
        options={LEAVE_TYPES}
        selected={fType}
        onSelect={(v) => setFType(v as LeaveType)}
        onClose={() => setShowTypePicker(false)}
      />
      <PickerSheet
        visible={showApproverPicker}
        title={t.approver}
        options={APPROVERS}
        selected={fApprover}
        onSelect={(v) => setFApprover(v as Approver)}
        onClose={() => setShowApproverPicker(false)}
      />
    </View>
  );
}

const ss = StyleSheet.create({
  pickerOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  pickerSheet:      { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 },
  pickerHandle:     { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  pickerTitle:      { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  pickerOption:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1 },
  pickerOptionText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  thresholdHeader:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  thresholdSubtitle:    { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  thresholdRow:         { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: 1 },
  thresholdDot:         { width: 10, height: 10, borderRadius: 5 },
  thresholdLabel:       { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  thresholdInput:       { width: 56, height: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  thresholdUnit:        { fontSize: 13, fontFamily: "Inter_400Regular", width: 12 },
  thresholdError:       { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  thresholdSaveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 10 },
  thresholdSaveBtnText:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  thresholdSuccess:      { flexDirection: "row", alignItems: "flex-start", gap: 6, borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8 },
  thresholdSuccessText:  { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
});

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 14 },

  hero:        { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  avatar:      { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText:  { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  heroInfo:    { flex: 1, gap: 4 },
  heroName:    { fontSize: 17, fontFamily: "Inter_700Bold" },
  heroRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  roleBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleBadgeText:{ fontSize: 11, fontFamily: "Inter_700Bold" },
  heroCode:    { fontSize: 12, fontFamily: "Inter_500Medium" },
  heroDept:    { fontSize: 12, fontFamily: "Inter_400Regular" },

  segBar:      { flexDirection: "row", borderBottomWidth: 1 },
  segBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" },
  segBtnActive:{},
  segBtnText:  { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  card:      { borderRadius: 14, borderWidth: 1, padding: 14, gap: 0 },
  cardTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 6 },

  infoRow:   { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: 1 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_500Medium", width: 90 },
  infoValue: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },

  balanceRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: 1 },
  balanceLabel:  { fontSize: 12, fontFamily: "Inter_500Medium", width: 72 },
  balanceBarBg:  { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  balanceBarFill:{ height: "100%", borderRadius: 3 },
  balanceDays:   { fontSize: 11, fontFamily: "Inter_600SemiBold", width: 42, textAlign: "right" },

  logoutBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fca5a5" },
  logoutBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#dc2626" },

  requestBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  requestBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  emptyState: { alignItems: "center", gap: 12, paddingVertical: 48 },
  emptyText:  { fontSize: 14, fontFamily: "Inter_500Medium" },

  leaveCard:    { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  leaveCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 },
  leaveType:    { fontSize: 14, fontFamily: "Inter_700Bold" },
  leaveDates:   { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText:{ fontSize: 11, fontFamily: "Inter_700Bold" },
  leaveMeta:    { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 10, borderTopWidth: 1 },
  leaveMetaChip:{ fontSize: 11, fontFamily: "Inter_500Medium", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  leaveNotes:   { fontSize: 12, fontFamily: "Inter_400Regular", paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, paddingTop: 10 },

  settingRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: 1 },
  settingLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  comingSoon:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  comingSoonText:{ fontSize: 11, fontFamily: "Inter_500Medium" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:   { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle:   { fontSize: 17, fontFamily: "Inter_700Bold" },

  formLabel:    { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 },
  formInput:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular" },
  formTextarea: { minHeight: 80, textAlignVertical: "top" },
  datesRow:     { flexDirection: "row", gap: 10 },
  selectBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  selectBtnText:{ fontSize: 13, fontFamily: "Inter_500Medium" },

  daysPreview:     { flexDirection: "row", alignItems: "center", gap: 7, padding: 10, borderRadius: 10, borderWidth: 1 },
  daysPreviewText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#2563eb" },

  modalBtns:    { flexDirection: "row", gap: 10 },
  cancelBtn:    { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  cancelBtnText:{ fontSize: 14, fontFamily: "Inter_600SemiBold" },
  saveBtn:      { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10 },
  saveBtnText:  { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
});
