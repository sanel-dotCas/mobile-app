import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";

const BASE_KEY = "efficiency_thresholds";

function storageKey(userCode: string): string {
  return userCode ? `${BASE_KEY}_${userCode}` : BASE_KEY;
}

export interface EfficiencyThresholds {
  greenMin: number;
  amberMin: number;
}

const DEFAULT_THRESHOLDS: EfficiencyThresholds = {
  greenMin: 80,
  amberMin: 60,
};

interface EfficiencyThresholdsContextValue {
  thresholds: EfficiencyThresholds;
  setThresholds: (t: EfficiencyThresholds) => Promise<void>;
  effColor: (efficiency: number, colors: { success: string; warning: string; destructive: string }) => string;
}

const EfficiencyThresholdsContext = createContext<EfficiencyThresholdsContextValue>({
  thresholds: DEFAULT_THRESHOLDS,
  setThresholds: async () => {},
  effColor: (eff, colors) =>
    eff >= DEFAULT_THRESHOLDS.greenMin
      ? colors.success
      : eff >= DEFAULT_THRESHOLDS.amberMin
      ? colors.warning
      : colors.destructive,
});

export function EfficiencyThresholdsProvider({ children }: { children: React.ReactNode }) {
  const { userCode } = useAuth();
  const [thresholds, setThresholdsState] = useState<EfficiencyThresholds>(DEFAULT_THRESHOLDS);

  useEffect(() => {
    const key = storageKey(userCode);
    AsyncStorage.getItem(key).then((raw) => {
      if (!raw) {
        setThresholdsState(DEFAULT_THRESHOLDS);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as Partial<EfficiencyThresholds>;
        if (typeof parsed.greenMin === "number" && typeof parsed.amberMin === "number") {
          setThresholdsState({ greenMin: parsed.greenMin, amberMin: parsed.amberMin });
        }
      } catch {
        setThresholdsState(DEFAULT_THRESHOLDS);
      }
    });
  }, [userCode]);

  const setThresholds = useCallback(async (t: EfficiencyThresholds) => {
    setThresholdsState(t);
    await AsyncStorage.setItem(storageKey(userCode), JSON.stringify(t));
  }, [userCode]);

  const effColor = useCallback(
    (
      efficiency: number,
      colors: { success: string; warning: string; destructive: string }
    ): string => {
      if (efficiency >= thresholds.greenMin) return colors.success;
      if (efficiency >= thresholds.amberMin) return colors.warning;
      return colors.destructive;
    },
    [thresholds]
  );

  return (
    <EfficiencyThresholdsContext.Provider value={{ thresholds, setThresholds, effColor }}>
      {children}
    </EfficiencyThresholdsContext.Provider>
  );
}

export function useEfficiencyThresholds() {
  return useContext(EfficiencyThresholdsContext);
}
