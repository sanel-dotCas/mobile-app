import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/context/AuthContext";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

/** Returns a user-scoped key so token cache is invalidated on account switch. */
function pushTokenKey(userCode: string) {
  return `yard_expo_push_token_${userCode}`;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const options = projectId ? { projectId } : undefined;
    const tokenData = await Notifications.getExpoPushTokenAsync(options);
    return tokenData.data;
  } catch {
    return null;
  }
}

async function savePushToken(
  sessionToken: string,
  token: string,
  userCode: string
): Promise<void> {
  try {
    const res = await fetch(`${BASE}/yard/auth/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mobile-session": sessionToken,
      },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      await AsyncStorage.setItem(pushTokenKey(userCode), token);
    }
  } catch {
    // Non-critical
  }
}

function navigateToInspection(
  router: ReturnType<typeof useRouter>,
  data: Record<string, unknown>
) {
  const inspectionId = data.inspectionId as number | undefined;
  const screen = data.screen as string | undefined;
  if (inspectionId && screen === "inspection") {
    router.push(`/yard/inspection?id=${inspectionId}`);
  }
}

/**
 * Null-rendering component that:
 * 1. Requests push permission and registers Expo push token with the API.
 *    Token cache is user-scoped so account switching forces re-registration.
 * 2. Handles notification taps (foreground + background) and cold-start deep-linking.
 *
 * Depends on `mobileSessionToken` from AuthContext so the registration effect
 * re-runs immediately when the session token arrives after login, eliminating
 * the race condition on first login.
 */
export function NotificationSetup() {
  const { isAuthenticated, role, userCode, mobileSessionToken } = useAuth();
  const router = useRouter();

  // Register push token — re-runs when session token or userCode changes
  useEffect(() => {
    if (
      !isAuthenticated ||
      role !== "technician" ||
      !mobileSessionToken ||
      Platform.OS === "web"
    ) {
      return;
    }

    let cancelled = false;

    (async () => {
      const pushToken = await registerForPushNotifications();
      if (cancelled || !pushToken) return;

      // User-scoped cache key prevents stale token from a previous account
      const stored = await AsyncStorage.getItem(pushTokenKey(userCode));
      if (stored !== pushToken) {
        await savePushToken(mobileSessionToken, pushToken, userCode);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, role, userCode, mobileSessionToken]);

  // Notification tap handler (foreground + background responses)
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Cold-start: handle notification that launched the app from terminated state
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.content.data) {
        navigateToInspection(
          router,
          response.notification.request.content.data as Record<string, unknown>
        );
      }
    });

    // Foreground/background tap listener
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        navigateToInspection(
          router,
          response.notification.request.content.data as Record<string, unknown>
        );
      }
    );

    return () => {
      sub.remove();
    };
  }, []);

  return null;
}
