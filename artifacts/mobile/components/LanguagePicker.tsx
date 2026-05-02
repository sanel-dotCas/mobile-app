import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LangCode } from "@/context/LanguageContext";
import { LANGUAGES, useLang } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

export function LanguagePicker() {
  const [open, setOpen] = useState(false);
  const { lang, setLang, t } = useLang();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const current = LANGUAGES[lang];

  const handleSelect = (code: LangCode) => {
    setLang(code);
    setOpen(false);
    Haptics.selectionAsync();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.trigger, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <Text style={styles.flag}>{current.flag}</Text>
        <Text style={[styles.code, { color: colors.foreground }]}>{lang.toUpperCase()}</Text>
        <Feather name="chevron-down" size={10} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View
            style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 20) + 8 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t.language}</Text>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {(Object.entries(LANGUAGES) as [LangCode, typeof LANGUAGES[LangCode]][]).map(([code, info]) => {
                const selected = code === lang;
                return (
                  <Pressable
                    key={code}
                    onPress={() => handleSelect(code)}
                    style={({ pressed }) => [
                      styles.langRow,
                      { borderBottomColor: colors.border, opacity: pressed ? 0.8 : 1 },
                      selected && [styles.langRowSelected, { backgroundColor: colors.accent }],
                    ]}
                  >
                    <Text style={styles.langFlag}>{info.flag}</Text>
                    <View style={styles.langInfo}>
                      <Text style={[styles.langNative, { color: colors.foreground }]}>{info.nativeLabel}</Text>
                      <Text style={[styles.langEn, { color: colors.mutedForeground }]}>{info.label}</Text>
                    </View>
                    {selected && (
                      <View style={[styles.checkWrap, { backgroundColor: colors.primary }]}>
                        <Feather name="check" size={12} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
  flag:             { fontSize: 15 },
  code:             { fontSize: 11, fontFamily: "Inter_700Bold" },
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:            { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  handle:           { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  sheetTitle:       { fontSize: 19, fontFamily: "Inter_700Bold", marginBottom: 14 },
  langRow:          { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, borderBottomWidth: 1 },
  langRowSelected:  { borderBottomWidth: 0, marginBottom: 1 },
  langFlag:         { fontSize: 30 },
  langInfo:         { flex: 1, gap: 2 },
  langNative:       { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  langEn:           { fontSize: 12, fontFamily: "Inter_400Regular" },
  checkWrap:        { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
