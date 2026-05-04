import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

export interface AttachmentRecord {
  id: string;
  objectPath: string;
  localUri?: string;
  name: string;
  contentType: string;
  capturedAt: string;
  uploaded: boolean;
  uploading?: boolean;
  error?: boolean;
}

type OnChange = (atts: AttachmentRecord[]) => void;

interface Props {
  attachments: AttachmentRecord[];
  onChange: OnChange;
  disabled?: boolean;
  label?: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function uploadAttachment(
  localUri: string,
  name: string,
  contentType: string,
): Promise<string> {
  const stat = await fetch(localUri);
  const blob = await stat.blob();
  const size = blob.size;

  const urlRes = await fetch(`${BASE}/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, size, contentType }),
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json();

  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!uploadRes.ok) throw new Error("Upload failed");

  return objectPath as string;
}

export function getAttachmentDisplayUri(att: AttachmentRecord): string {
  if (att.localUri && !att.uploaded) return att.localUri;
  if (att.objectPath) return `${BASE}/storage/objects/${att.objectPath.replace(/^\/objects\//, "")}`;
  return att.localUri ?? "";
}

export default function MediaAttachments({ attachments, onChange, disabled, label = "Photos & Videos" }: Props) {
  const colors = useColors();

  const addFromPicker = useCallback(
    async (pickerFn: () => Promise<ImagePicker.ImagePickerResult>) => {
      if (disabled) return;
      const result = await pickerFn();
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const localUri = asset.uri;
      const isVideo = asset.type === "video";
      const ext = isVideo ? "mp4" : "jpg";
      const contentType = isVideo ? "video/mp4" : "image/jpeg";
      const name = `attachment_${Date.now()}.${ext}`;

      const placeholder: AttachmentRecord = {
        id: uid(),
        objectPath: "",
        localUri,
        name,
        contentType,
        capturedAt: new Date().toISOString(),
        uploaded: false,
        uploading: true,
      };

      onChange([...attachments, placeholder]);

      try {
        const objectPath = await uploadAttachment(localUri, name, contentType);
        const updated = [...attachments, placeholder].map((a) =>
          a.id === placeholder.id ? { ...a, objectPath, uploaded: true, uploading: false } : a,
        );
        onChange(updated);
      } catch {
        const errored = [...attachments, placeholder].map((a) =>
          a.id === placeholder.id ? { ...a, uploading: false, error: true } : a,
        );
        onChange(errored);
        Alert.alert("Upload Failed", "Could not upload the photo. Tap the × to remove it and try again.");
      }
    },
    [attachments, onChange, disabled],
  );

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow camera access in Settings.");
      return;
    }
    addFromPicker(() => ImagePicker.launchCameraAsync({ quality: 0.85, mediaTypes: ImagePicker.MediaTypeOptions.All }));
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow photo library access in Settings.");
      return;
    }
    addFromPicker(() =>
      ImagePicker.launchImageLibraryAsync({
        quality: 0.85,
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: false,
      }),
    );
  };

  const remove = (id: string) => {
    Alert.alert("Remove Photo", "Remove this attachment?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => onChange(attachments.filter((a) => a.id !== id)) },
    ]);
  };

  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={st.header}>
        <Feather name="camera" size={14} color={colors.primary} />
        <Text style={[st.title, { color: colors.foreground }]}>{label}</Text>
        <Text style={[st.count, { color: colors.mutedForeground }]}>
          {attachments.length > 0 ? `${attachments.length} file${attachments.length !== 1 ? "s" : ""}` : "None"}
        </Text>
      </View>

      {attachments.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.thumbRow} contentContainerStyle={st.thumbContent}>
          {attachments.map((att) => {
            const uri = getAttachmentDisplayUri(att);
            const isVideo = att.contentType.startsWith("video/");
            return (
              <View key={att.id} style={st.thumbWrap}>
                {isVideo ? (
                  <View style={[st.videoThumb, { backgroundColor: colors.accent }]}>
                    <Feather name="video" size={24} color={colors.primary} />
                  </View>
                ) : (
                  <Image source={{ uri }} style={st.thumb} resizeMode="cover" />
                )}

                {att.uploading && (
                  <View style={st.overlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}
                {att.error && (
                  <View style={[st.overlay, { backgroundColor: "rgba(239,68,68,0.7)" }]}>
                    <Feather name="alert-circle" size={16} color="#fff" />
                  </View>
                )}
                {att.uploaded && !att.uploading && (
                  <View style={st.uploadedBadge}>
                    <Feather name="check" size={9} color="#fff" />
                  </View>
                )}

                {!disabled && (
                  <Pressable style={st.removeBtn} onPress={() => remove(att.id)}>
                    <Feather name="x" size={10} color="#fff" />
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {!disabled && (
        <View style={st.btnRow}>
          <Pressable style={[st.btn, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={handleCamera}>
            <Feather name="camera" size={14} color={colors.primary} />
            <Text style={[st.btnText, { color: colors.primary }]}>Camera</Text>
          </Pressable>
          <Pressable style={[st.btn, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={handleGallery}>
            <Feather name="image" size={14} color={colors.primary} />
            <Text style={[st.btnText, { color: colors.primary }]}>Gallery</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  count: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  thumbRow: {
    marginBottom: 10,
  },
  thumbContent: {
    gap: 8,
    paddingRight: 4,
  },
  thumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  thumb: {
    width: 80,
    height: 80,
  },
  videoThumb: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadedBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "#16a34a",
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
