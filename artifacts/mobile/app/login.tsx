import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
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

const PIN_LENGTH = 4;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

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
  const { attemptPin } = useAuth();

  const [pin, setPin] = useState<string[]>([]);
  const [error, setError] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const errorFade = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(errorFade, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(errorFade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setError(false));
  };

  const handleKey = async (key: string) => {
    if (key === "⌫") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPin((prev) => prev.slice(0, -1));
      setError(false);
      return;
    }

    if (key === "→") {
      if (pin.length < PIN_LENGTH) return;
      await handleSubmit();
      return;
    }

    if (pin.length >= PIN_LENGTH) return;
    Haptics.selectionAsync();
    const next = [...pin, key];
    setPin(next);

    if (next.length === PIN_LENGTH) {
      setTimeout(() => handleSubmitPin(next.join("")), 80);
    }
  };

  const handleSubmit = async () => {
    await handleSubmitPin(pin.join(""));
  };

  const handleSubmitPin = async (code: string) => {
    const ok = await attemptPin(code);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(true);
      shake();
      setTimeout(() => setPin([]), 500);
    }
  };

  const isPortrait = SCREEN_H > SCREEN_W;

  if (!isPortrait || Platform.OS === "web") {
    return <LandscapeLogin pin={pin} error={error} shakeAnim={shakeAnim} errorFade={errorFade} handleKey={handleKey} colors={colors} insets={insets} />;
  }

  return <PortraitLogin pin={pin} error={error} shakeAnim={shakeAnim} errorFade={errorFade} handleKey={handleKey} colors={colors} insets={insets} />;
}

interface LoginProps {
  pin: string[];
  error: boolean;
  shakeAnim: Animated.Value;
  errorFade: Animated.Value;
  handleKey: (key: string) => void;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}

function PinDots({ pin, error, shakeAnim, colors }: Pick<LoginProps, "pin" | "error" | "shakeAnim" | "colors">) {
  return (
    <Animated.View style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => {
        const filled = i < pin.length;
        return (
          <View
            key={i}
            style={[
              styles.pinBox,
              {
                backgroundColor: filled
                  ? error
                    ? "#fee2e2"
                    : "#f1f5f9"
                  : "#f8fafc",
                borderColor: filled
                  ? error
                    ? "#ef4444"
                    : "#cbd5e1"
                  : "#e2e8f0",
              },
            ]}
          >
            {filled && (
              <View
                style={[
                  styles.pinDot,
                  { backgroundColor: error ? "#ef4444" : "#0f172a" },
                ]}
              />
            )}
          </View>
        );
      })}
    </Animated.View>
  );
}

function NumPad({ handleKey, colors }: Pick<LoginProps, "handleKey" | "colors">) {
  return (
    <View style={styles.numpad}>
      {NUMPAD.map((row, ri) => (
        <View key={ri} style={styles.numpadRow}>
          {row.map((key) => {
            const isSubmit = key === "→";
            const isBackspace = key === "⌫";
            return (
              <Pressable
                key={key}
                onPress={() => handleKey(key)}
                style={({ pressed }) => [
                  styles.numKey,
                  isSubmit && styles.numKeySubmit,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                {isSubmit ? (
                  <Feather name="arrow-right" size={20} color="#fff" />
                ) : isBackspace ? (
                  <Feather name="delete" size={20} color="#64748b" />
                ) : (
                  <Text style={styles.numKeyText}>{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ErrorMsg({ errorFade }: Pick<LoginProps, "errorFade">) {
  return (
    <Animated.Text style={[styles.errorMsg, { opacity: errorFade }]}>
      Incorrect PIN. Please try again.
    </Animated.Text>
  );
}

function PortraitLogin({ pin, error, shakeAnim, errorFade, handleKey, colors, insets }: LoginProps) {
  return (
    <View style={[styles.portraitRoot, { backgroundColor: "#fff" }]}>
      {/* Hero image top half */}
      <View style={styles.heroContainer}>
        <Image
          source={require("@/assets/images/car_hero.png")}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={styles.heroOverlay} />
      </View>

      {/* Login panel bottom half */}
      <ScrollView
        style={styles.portraitPanel}
        contentContainerStyle={[styles.portraitPanelContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Logo */}
        <Text style={styles.logoText}>IGMMA</Text>
        <Text style={styles.panelTitle}>Sign with Numerical Password</Text>

        <PinDots pin={pin} error={error} shakeAnim={shakeAnim} colors={colors} />
        <ErrorMsg errorFade={errorFade} />

        <NumPad handleKey={handleKey} colors={colors} />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or Sign in with</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.emailBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="mail" size={16} color="#0f172a" />
          <Text style={styles.emailBtnText}>Email</Text>
        </Pressable>

        <Text style={styles.hintText}>Demo PIN: 1234</Text>
      </ScrollView>
    </View>
  );
}

function LandscapeLogin({ pin, error, shakeAnim, errorFade, handleKey, colors, insets }: LoginProps) {
  return (
    <View style={[styles.landscapeRoot, { backgroundColor: "#fff" }]}>
      {/* Left: login form */}
      <ScrollView
        style={styles.landscapeLeft}
        contentContainerStyle={[styles.landscapeLeftContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.logoText}>IGMMA</Text>
        <Text style={styles.panelTitle}>Sign with Numerical Password</Text>

        <PinDots pin={pin} error={error} shakeAnim={shakeAnim} colors={colors} />
        <ErrorMsg errorFade={errorFade} />

        <NumPad handleKey={handleKey} colors={colors} />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or Sign in with</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.emailBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="mail" size={16} color="#0f172a" />
          <Text style={styles.emailBtnText}>Email</Text>
        </Pressable>

        <Text style={styles.hintText}>Demo PIN: 1234</Text>
      </ScrollView>

      {/* Right: hero image */}
      <View style={styles.landscapeRight}>
        <Image
          source={require("@/assets/images/car_hero.png")}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={styles.landscapeOverlay} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ── Portrait ── */
  portraitRoot: {
    flex: 1,
  },
  heroContainer: {
    height: "38%",
    position: "relative",
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(200,230,255,0.15)",
  },
  portraitPanel: {
    flex: 1,
  },
  portraitPanelContent: {
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: "center",
    gap: 0,
  },

  /* ── Landscape / Web ── */
  landscapeRoot: {
    flex: 1,
    flexDirection: "row",
  },
  landscapeLeft: {
    flex: 1,
  },
  landscapeLeftContent: {
    paddingHorizontal: 40,
    alignItems: "center",
    gap: 0,
  },
  landscapeRight: {
    width: "44%",
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    overflow: "hidden",
    position: "relative",
  },
  landscapeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(200,220,255,0.08)",
  },

  /* ── Shared ── */
  logoText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#0f172a",
    letterSpacing: 5,
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 24,
  },
  pinRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  pinBox: {
    width: 72,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  errorMsg: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#ef4444",
    marginBottom: 12,
    textAlign: "center",
    height: 18,
  },
  numpad: {
    gap: 4,
    marginTop: 10,
    marginBottom: 24,
    width: "100%",
    maxWidth: 340,
  },
  numpadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  numKey: {
    flex: 1,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
  },
  numKeySubmit: {
    backgroundColor: "#0f172a",
  },
  numKeyText: {
    fontSize: 22,
    fontFamily: "Inter_400Regular",
    color: "#0f172a",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    gap: 10,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94a3b8",
  },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    maxWidth: 340,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    marginBottom: 16,
  },
  emailBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#0f172a",
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94a3b8",
    textAlign: "center",
  },
});
