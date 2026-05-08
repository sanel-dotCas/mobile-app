import { Platform, Alert } from "react-native";

const API_BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

let Print: typeof import("expo-print") | null = null;
let Sharing: typeof import("expo-sharing") | null = null;

async function loadNativeModules() {
  if (Platform.OS === "web") return;
  if (!Print) Print = await import("expo-print");
  if (!Sharing) Sharing = await import("expo-sharing");
}

export function usePlanCardShare() {
  const sharePlan = async (planNumber: string) => {
    const url = `${API_BASE}/service-plans/print-card?planNumber=${encodeURIComponent(planNumber)}`;

    if (Platform.OS === "web") {
      // Open the server-rendered, HTML-escaped print-card route in a new tab.
      // planNumber is non-guessable so there is no enumeration risk.
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        Alert.alert("Popup Blocked", "Please allow popups to open the printable plan card.");
      }
      return;
    }

    // Native: fetch server-rendered HTML → render as PDF → share
    try {
      await loadNativeModules();
      if (!Print || !Sharing) return;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const html = await res.text();

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Plan Card — ${planNumber}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        await Print.printAsync({ uri });
      }
    } catch {
      Alert.alert("Error", "Could not generate the plan card. Please try again.");
    }
  };

  return { sharePlan };
}
