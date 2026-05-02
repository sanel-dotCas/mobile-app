import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { EstimatesProvider } from "@/context/EstimatesContext";
import { useJobs, JobsProvider } from "@/context/JobsContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { useStages, StagesProvider } from "@/context/StagesContext";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Load Feather icon font locally so Metro bundles it and Font.isLoaded('feather') returns
    // true before the Icon component mounts — prevents the blank-icon flash on Android.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    feather: require("../assets/fonts/Feather.ttf"),
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
                        <Stack screenOptions={{ headerShown: false }}>
                          <Stack.Screen name="login" />
                          <Stack.Screen name="(tabs)" />
                          <Stack.Screen name="(supervisor)" />
                          <Stack.Screen name="(estimator)" />
                          <Stack.Screen name="job/[id]" options={{ presentation: "card" }} />
                          <Stack.Screen name="estimate/[id]" options={{ presentation: "card" }} />
                          <Stack.Screen name="notifications" options={{ presentation: "card" }} />
                          <Stack.Screen name="yard/vehicle" options={{ presentation: "card" }} />
                          <Stack.Screen name="yard/inspection" options={{ presentation: "card" }} />
                          <Stack.Screen name="yard/new-inspection" options={{ presentation: "card" }} />
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
