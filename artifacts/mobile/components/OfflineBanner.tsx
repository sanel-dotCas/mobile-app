import React, { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJobs } from "@/context/JobsContext";

export function OfflineBanner() {
  const { state } = useJobs();
  const { top } = useSafeAreaInsets();
  const [bannerHeight, setBannerHeight] = useState(60);
  const hideOffset = -(bannerHeight + top);
  const translateY = useRef(new Animated.Value(hideOffset)).current;
  const isOffline = state.isOffline;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOffline ? 0 : hideOffset,
      duration: 300,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [isOffline, translateY, hideOffset]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setBannerHeight(h);
  };

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={onLayout}
      style={[
        styles.container,
        { paddingTop: top + 6, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.text}>No internet connection</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
    paddingBottom: 8,
    backgroundColor: "transparent",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF453A",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.1,
  },
});
