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
        if (job.status === "completed") return;
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
                  <GestureHandlerRootView>
                    <KeyboardProvider>
                      <DelayChecker />
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="login" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="(supervisor)" />
                        <Stack.Screen name="job/[id]" options={{ presentation: "card" }} />
                        <Stack.Screen name="notifications" options={{ presentation: "card" }} />
                      </Stack>
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </StagesProvider>
              </JobsProvider>
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
