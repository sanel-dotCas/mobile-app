import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationSetup } from "@/components/NotificationSetup";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { EstimatesProvider } from "@/context/EstimatesContext";
import { useJobs, JobsProvider } from "@/context/JobsContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { useStages, StagesProvider } from "@/context/StagesContext";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

const BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

const NOTIFIED_KEY = "yard_pdi_notified_ids";

function DelayChecker() {
  const { sortedStages } = useStages();
  const { state, addDelayNotification } = useJobs();

  const stagesRef = useRef(sortedStages);
  stagesRef.current = sortedStages;
  const jobsRef = useRef(state.jobs);
  jobsRef.current = state.jobs;
  const addDelayRef = useRef(addDelayNotification);
  addDelayRef.current = addDelayNotification;

  useEffect(() => {
    const runCheck = () => {
      const now = Date.now();
      jobsRef.current.forEach((job) => {
        if (job.status === "completed" || job.status === "on_hold") return;
        const stage = stagesRef.current.find((s) => s.id === job.currentStageId);
        if (!stage) return;
        const entry = [...(job.stageHistory ?? [])].reverse().find((e) => e.stageId === job.currentStageId);
        if (!entry) return;
        const hoursElapsed = (now - new Date(entry.enteredAt).getTime()) / 3600000;
        if (hoursElapsed > stage.expectedHours) {
          const overdueHours = Math.round((hoursElapsed - stage.expectedHours) * 10) / 10;
          addDelayRef.current(job.id, job.estimateNumber, stage.name, stage.id, overdueHours);
        }
      });
    };
    runCheck();
    const interval = setInterval(runCheck, 300000);
    return () => clearInterval(interval);
  }, []);

  return null;
}

function StageAutoAdvancer() {
  const { state, advanceStage } = useJobs();
  const { sortedStages } = useStages();

  const processedRef = useRef<Set<string>>(new Set());
  const stateRef = useRef(state);
  stateRef.current = state;
  const stagesRef = useRef(sortedStages);
  stagesRef.current = sortedStages;
  const advanceRef = useRef(advanceStage);
  advanceRef.current = advanceStage;

  useEffect(() => {
    stateRef.current.jobs.forEach((job) => {
      if (job.status === "completed" || job.status === "on_hold") return;
      if (job.tasks.length === 0) return;

      const allDone = job.tasks.every((t) => t.status === "done");
      const key = `${job.id}::${job.currentStageId}`;

      if (!allDone) {
        processedRef.current.delete(key);
        return;
      }
      if (processedRef.current.has(key)) return;

      const currentIdx = stagesRef.current.findIndex((s) => s.id === job.currentStageId);
      const currentStage = stagesRef.current[currentIdx];
      const nextStage = currentIdx >= 0 && currentIdx < stagesRef.current.length - 1
        ? stagesRef.current[currentIdx + 1] : null;

      if (!currentStage || currentStage.isManual || !nextStage) return;

      processedRef.current.add(key);
      advanceRef.current(job.id, nextStage.id, nextStage.name);
    });
  }, [state.jobs]);

  return null;
}

function YardPDIChecker() {
  const { role, userCode, isAuthenticated } = useAuth();
  const { addYardNotification } = useJobs();
  const addYardRef = useRef(addYardNotification);
  addYardRef.current = addYardNotification;

  useEffect(() => {
    if (!isAuthenticated || role !== "technician") return;

    const check = async () => {
      try {
        const res = await fetch(`${BASE}/yard/inspections?assignedTo=${userCode}&status=queued&limit=20`);
        if (!res.ok) return;
        const data = await res.json();
        const inspections: Array<{ id: number; inspectionNumber: string; vehicleName: string }> =
          data.inspections ?? [];
        if (inspections.length === 0) return;

        const stored = await AsyncStorage.getItem(NOTIFIED_KEY);
        const notifiedIds: number[] = stored ? JSON.parse(stored) : [];
        const newOnes = inspections.filter((i) => !notifiedIds.includes(i.id));

        for (const insp of newOnes) {
          addYardRef.current(insp.id, insp.inspectionNumber, insp.vehicleName);
        }

        if (newOnes.length > 0) {
          const updatedIds = [...notifiedIds, ...newOnes.map((i) => i.id)];
          await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(updatedIds));
        }
      } catch {
        // non-critical
      }
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, role, userCode]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <JobsProvider>
                <StagesProvider>
                  <EstimatesProvider>
                    <GestureHandlerRootView>
                      <KeyboardProvider>
                        <DelayChecker />
                        <StageAutoAdvancer />
                        <YardPDIChecker />
                        <NotificationSetup />
                        <OfflineBanner />
                        <Stack screenOptions={{ headerShown: false }}>
                          <Stack.Screen name="login" />
                          <Stack.Screen name="(tabs)" />
                          <Stack.Screen name="(supervisor)" />
                          <Stack.Screen name="(estimator)" />
                          <Stack.Screen name="(parts)" />
                          <Stack.Screen name="(admin)" />
                          <Stack.Screen name="job/[id]" options={{ presentation: "card" }} />
                          <Stack.Screen name="estimate/[id]" options={{ presentation: "card" }} />
                          <Stack.Screen name="notifications" options={{ presentation: "card" }} />
                          <Stack.Screen name="yard/vehicle" options={{ presentation: "card" }} />
                          <Stack.Screen name="yard/inspection" options={{ presentation: "card" }} />
                          <Stack.Screen name="yard/new-inspection" options={{ presentation: "card" }} />
                          <Stack.Screen name="parts/item" options={{ presentation: "card" }} />
                        </Stack>
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </EstimatesProvider>
                </StagesProvider>
              </JobsProvider>
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
