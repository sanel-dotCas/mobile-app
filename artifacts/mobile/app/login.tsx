import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const NUMPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["⌫", "0", "→"],
];

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { attemptLogin } = useAuth();
  const { t } = useLang();
  const { width: winW, height: winH } = useWindowDimensions();

  const [letterInput, setLetterInput] = useState<string[]>([]);
  const [pinInput, setPinInput] = useState<string[]>([]);
  const [phase, setPhase] = useState<"letters" | "pin">("letters");
  const [error, setError] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face" | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const errorFade = useRef(new Animated.Value(0)).current;

  const isPortrait = winH > winW;

  useEffect(() => {
    (async () => {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHw && enrolled) {
        setBiometricsAvailable(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("face");
        } else {
          setBiometricType("fingerprint");
        }
      }
    })();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(errorFade, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(errorFade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setError(false));
  };

  const handleLetterKey = (key: string) => {
    if (key === "⌫") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLetterInput((prev) => prev.slice(0, -1));
      return;
    }
    if (letterInput.length >= 2) return;
    Haptics.selectionAsync();
    const next = [...letterInput, key];
    setLetterInput(next);
    if (next.length === 2) {
      setTimeout(() => setPhase("pin"), 150);
    }
  };

  const handlePinKey = async (key: string) => {
    if (key === "⌫") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (pinInput.length === 0) {
        setPhase("letters");
        setLetterInput((prev) => prev.slice(0, -1));
      } else {
        setPinInput((prev) => prev.slice(0, -1));
      }
      return;
    }
    if (key === "→") {
      if (pinInput.length < 4) return;
      await tryLogin(pinInput.join(""));
      return;
    }
    if (pinInput.length >= 4) return;
    Haptics.selectionAsync();
    const next = [...pinInput, key];
    setPinInput(next);
    if (next.length === 4) {
      setTimeout(() => tryLogin(next.join("")), 80);
    }
  };

  const tryLogin = async (pin: string) => {
    const result = await attemptLogin(letterInput.join(""), pin);
    if (result) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result === "supervisor") router.replace("/(supervisor)");
      else if (result === "estimator") router.replace("/(estimator)");
      else router.replace("/(tabs)");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(true);
      shake();
      setTimeout(() => {
        setLetterInput([]);
        setPinInput([]);
        setPhase("letters");
      }, 600);
    }
  };

  const handleBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to sign in",
        fallbackLabel: "Use PIN",
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      }
    } catch {}
  };

  const formContent = (
    <View style={styles.form}>
      <Text style={styles.logo}>IGMMA</Text>
      <Text style={styles.subtitle}>{t.signIn}</Text>

      {/* 6-box input: 2 letters + 4 digits */}
      <Animated.View style={[styles.inputRow, { transform: [{ translateX: shakeAnim }] }]}>
        <View style={styles.letterGroup}>
          {[0, 1].map((i) => (
            <View
              key={`l${i}`}
              style={[
                styles.inputBox,
                styles.letterBox,
                phase === "letters" && i === letterInput.length && styles.inputBoxActive,
                error && styles.inputBoxError,
                { borderColor: phase === "letters" && i === letterInput.length ? "#1d4ed8" : error ? "#ef4444" : "#e2e8f0" },
              ]}
            >
              <Text style={[styles.inputChar, { color: error ? "#ef4444" : "#0f172a" }]}>
                {letterInput[i] ?? ""}
              </Text>
              <Text style={styles.inputLabel}>A-Z</Text>
            </View>
          ))}
        </View>

        <View style={styles.inputDivider}>
          <Text style={styles.inputDividerText}>+</Text>
        </View>

        <View style={styles.pinGroup}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={`p${i}`}
              style={[
                styles.inputBox,
                styles.pinBox,
                phase === "pin" && i === pinInput.length && styles.inputBoxActive,
                error && styles.inputBoxError,
                { borderColor: phase === "pin" && i === pinInput.length ? "#1d4ed8" : error ? "#ef4444" : "#e2e8f0" },
              ]}
            >
              {pinInput[i] !== undefined ? (
                <View style={[styles.pinDot, { backgroundColor: error ? "#ef4444" : "#0f172a" }]} />
              ) : null}
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Phase indicator */}
      <View style={styles.phaseRow}>
        <View style={[styles.phaseStep, { backgroundColor: "#1d4ed8" }]}>
          <Text style={styles.phaseStepText}>1</Text>
        </View>
        <Text style={[styles.phaseLabel, phase === "letters" && styles.phaseLabelActive]}>
          2-Letter Code
        </Text>
        <View style={[styles.phaseLine, { backgroundColor: phase === "pin" ? "#1d4ed8" : "#e2e8f0" }]} />
        <View style={[styles.phaseStep, { backgroundColor: phase === "pin" ? "#1d4ed8" : "#e2e8f0" }]}>
          <Text style={styles.phaseStepText}>2</Text>
        </View>
        <Text style={[styles.phaseLabel, phase === "pin" && styles.phaseLabelActive]}>
          4-Digit PIN
        </Text>
      </View>

      <Animated.Text style={[styles.errorText, { opacity: errorFade }]}>
        {t.invalidCredentials}
      </Animated.Text>

      {/* Letter keyboard */}
      {phase === "letters" && (
        <View style={styles.letterKeyboard}>
          {[...Array(Math.ceil(LETTERS.length / 6))].map((_, row) => (
            <View key={row} style={styles.letterRow}>
              {LETTERS.slice(row * 6, row * 6 + 6).map((letter) => (
                <Pressable
                  key={letter}
                  onPress={() => handleLetterKey(letter)}
                  style={({ pressed }) => [styles.letterKey, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={styles.letterKeyText}>{letter}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          <View style={styles.letterRow}>
            <Pressable
              onPress={() => handleLetterKey("⌫")}
              style={({ pressed }) => [styles.letterKey, styles.letterKeyWide, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="delete" size={16} color="#64748b" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Numpad */}
      {phase === "pin" && (
        <View style={styles.numpad}>
          {NUMPAD.map((row, ri) => (
            <View key={ri} style={styles.numpadRow}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => handlePinKey(key)}
                  style={({ pressed }) => [
                    styles.numKey,
                    key === "→" && styles.numKeySubmit,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  {key === "→" ? (
                    <Feather name="arrow-right" size={20} color="#fff" />
                  ) : key === "⌫" ? (
                    <Feather name="delete" size={20} color="#64748b" />
                  ) : (
                    <Text style={styles.numKeyText}>{key}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Biometrics */}
      {biometricsAvailable && (
        <Pressable onPress={handleBiometric} style={styles.biometricBtn}>
          <Feather
            name={biometricType === "face" ? "eye" : "hexagon"}
            size={20}
            color="#1d4ed8"
          />
          <Text style={styles.biometricText}>
            {biometricType === "face" ? t.signIn + " — Face ID" : t.signIn + " — Fingerprint"}
          </Text>
        </Pressable>
      )}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t.orSignInWith}</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable style={({ pressed }) => [styles.emailBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Feather name="mail" size={16} color="#0f172a" />
        <Text style={styles.emailBtnText}>Email</Text>
      </Pressable>

      <Text style={styles.hintText}>{t.demoHint}</Text>
    </View>
  );

  if (!isPortrait) {
    return (
      <View style={styles.landscapeRoot}>
        <ScrollView
          style={styles.landscapeLeft}
          contentContainerStyle={[styles.landscapeContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {formContent}
        </ScrollView>
        <View style={styles.landscapeRight}>
          <Image source={require("@/assets/images/car_hero.png")} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.overlay} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.portraitRoot}>
      <View style={styles.heroContainer}>
        <Image source={require("@/assets/images/car_hero.png")} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.overlay} />
      </View>
      <ScrollView
        style={styles.portraitScroll}
        contentContainerStyle={[styles.portraitContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {formContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  portraitRoot: { flex: 1, backgroundColor: "#fff" },
  heroContainer: { height: "30%", overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroImage: { width: "100%", height: "100%" },
  portraitScroll: { flex: 1 },
  portraitContent: { paddingHorizontal: 20, paddingTop: 20 },
  landscapeRoot: { flex: 1, flexDirection: "row", backgroundColor: "#fff" },
  landscapeLeft: { flex: 1 },
  landscapeContent: { paddingHorizontal: 36 },
  landscapeRight: { width: "42%", overflow: "hidden", borderTopLeftRadius: 24, borderBottomLeftRadius: 24 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(200,225,255,0.1)" },
  form: { alignItems: "center", gap: 0 },
  logo: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#0f172a", letterSpacing: 5, marginBottom: 4 },
  subtitle: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#64748b", marginBottom: 20 },

  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  letterGroup: { flexDirection: "row", gap: 6 },
  pinGroup: { flexDirection: "row", gap: 6 },
  inputDivider: { alignItems: "center", justifyContent: "center", width: 20 },
  inputDividerText: { fontSize: 18, color: "#94a3b8", fontFamily: "Inter_400Regular" },

  inputBox: {
    width: 44, height: 52, borderRadius: 10, borderWidth: 2,
    borderColor: "#e2e8f0", backgroundColor: "#f8fafc",
    alignItems: "center", justifyContent: "center",
  },
  letterBox: { width: 50, height: 52 },
  pinBox: { width: 44, height: 52 },
  inputBoxActive: { borderColor: "#1d4ed8", backgroundColor: "#eff6ff" },
  inputBoxError: { borderColor: "#ef4444", backgroundColor: "#fff1f2" },
  inputChar: { fontSize: 20, fontFamily: "Inter_700Bold", lineHeight: 24 },
  inputLabel: { fontSize: 8, fontFamily: "Inter_400Regular", color: "#94a3b8", marginTop: 1 },
  pinDot: { width: 12, height: 12, borderRadius: 6 },

  phaseRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  phaseStep: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  phaseStepText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  phaseLine: { width: 24, height: 2, borderRadius: 1 },
  phaseLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  phaseLabelActive: { color: "#1d4ed8", fontFamily: "Inter_600SemiBold" },

  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#ef4444", marginBottom: 8, height: 16, textAlign: "center" },

  letterKeyboard: { width: "100%", maxWidth: 340, gap: 4, marginBottom: 12 },
  letterRow: { flexDirection: "row", gap: 4, justifyContent: "center" },
  letterKey: {
    width: 44, height: 40, borderRadius: 8, backgroundColor: "#f8fafc",
    alignItems: "center", justifyContent: "center",
  },
  letterKeyWide: { width: 100 },
  letterKeyText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0f172a" },

  numpad: { gap: 4, width: "100%", maxWidth: 320, marginBottom: 16 },
  numpadRow: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  numKey: { flex: 1, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#f8fafc" },
  numKeySubmit: { backgroundColor: "#0f172a" },
  numKeyText: { fontSize: 22, fontFamily: "Inter_400Regular", color: "#0f172a" },

  biometricBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
    backgroundColor: "#eff6ff", marginBottom: 10, width: "100%", maxWidth: 320, justifyContent: "center",
  },
  biometricText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1d4ed8" },

  dividerRow: { flexDirection: "row", alignItems: "center", width: "100%", maxWidth: 320, gap: 10, marginBottom: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e2e8f0" },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8" },

  emailBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    width: "100%", maxWidth: 320, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#e2e8f0", justifyContent: "center", marginBottom: 14,
  },
  emailBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#0f172a" },
  hintText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8", textAlign: "center" },
});
