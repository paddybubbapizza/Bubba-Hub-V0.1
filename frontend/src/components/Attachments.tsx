import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Ionicons from "@react-native-vector-icons/ionicons";

import { ApiError, fileUrl, getAuthToken } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { FileRef } from "@/src/types";

const UPLOAD_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/upload`;

async function uploadFile(uri: string, name: string, type: string): Promise<FileRef> {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type } as any);
  }
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` },
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.detail ?? "Upload failed", res.status);
  return data as FileRef;
}

function fmtSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Explain a denied permission and offer the settings shortcut (second denial / blocked). */
function explainDenied(what: string) {
  Alert.alert(
    `${what} access is off`,
    `Turn it on in Settings to attach ${what.toLowerCase()} to your report.`,
    [{ text: "Not now", style: "cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() }],
  );
}

type PickerProps = {
  files: FileRef[];
  onChange: (files: FileRef[]) => void;
  max?: number;
  photosOnly?: boolean;
  testID?: string;
};

export function AttachmentPicker({ files, onChange, max = 6, photosOnly, testID }: PickerProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const add = async (uri: string, name: string, type: string) => {
    setBusy(true);
    try {
      const f = await uploadFile(uri, name, type);
      onChange([...files, f]);
    } catch (e: any) {
      toast(e?.message ?? "Could not upload that file", "error");
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async (fromCamera: boolean) => {
    if (fromCamera && Platform.OS === "web") return toast("Use the photo library on web", "error");
    const current = fromCamera
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      if (!current.canAskAgain && Platform.OS !== "web") return explainDenied(fromCamera ? "Camera" : "Photos");
      const asked = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      granted = asked.granted;
      if (!granted) {
        if (Platform.OS !== "web") explainDenied(fromCamera ? "Camera" : "Photos");
        return;
      }
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    await add(a.uri, a.fileName ?? `photo-${Date.now()}.jpg`, a.mimeType ?? "image/jpeg");
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    await add(a.uri, a.name, a.mimeType ?? "application/octet-stream");
  };

  const full = files.length >= max;

  return (
    <View style={styles.picker} testID={testID}>
      <AttachmentList files={files} onRemove={(id) => onChange(files.filter((f) => f.id !== id))} />
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.busyText}>Uploading…</Text>
        </View>
      ) : full ? (
        <Text style={styles.hint}>You can attach up to {max} files.</Text>
      ) : (
        <View style={styles.buttons}>
          {Platform.OS !== "web" ? (
            <Pressable style={styles.btn} onPress={() => pickPhoto(true)} testID="attach-camera">
              <Ionicons name="camera" size={18} color={colors.brand} />
              <Text style={styles.btnText}>Take photo</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.btn} onPress={() => pickPhoto(false)} testID="attach-photo">
            <Ionicons name="image" size={18} color={colors.brand} />
            <Text style={styles.btnText}>Add photo</Text>
          </Pressable>
          {!photosOnly ? (
            <Pressable style={styles.btn} onPress={pickDocument} testID="attach-file">
              <Ionicons name="document-attach" size={18} color={colors.brand} />
              <Text style={styles.btnText}>Add file</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function AttachmentList({ files, onRemove }: { files: FileRef[]; onRemove?: (id: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (files.length === 0) return null;
  const images = files.filter((f) => f.isImage);
  const docs = files.filter((f) => !f.isImage);
  const token = getAuthToken() ?? "";
  return (
    <View style={styles.list}>
      {images.length ? (
        <View style={styles.grid}>
          {images.map((f) => (
            <Pressable key={f.id} style={styles.thumbWrap} onPress={() => Linking.openURL(fileUrl(f.url))} testID={`attachment-${f.id}`}>
              <Image
                source={{ uri: fileUrl(f.url), headers: { Authorization: `Bearer ${token}` } }}
                style={styles.thumb}
                contentFit="cover"
              />
              {onRemove ? (
                <Pressable style={styles.remove} onPress={() => onRemove(f.id)} hitSlop={8} testID={`remove-attachment-${f.id}`}>
                  <Ionicons name="close" size={14} color={colors.onBrand} />
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {docs.map((f) => (
        <Pressable key={f.id} style={styles.doc} onPress={() => Linking.openURL(fileUrl(f.url))} testID={`attachment-${f.id}`}>
          <Ionicons name="document-text" size={22} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.docName} numberOfLines={1}>{f.name}</Text>
            <Text style={styles.docMeta}>{fmtSize(f.size)}</Text>
          </View>
          {onRemove ? (
            <Pressable onPress={() => onRemove(f.id)} hitSlop={8} testID={`remove-attachment-${f.id}`}>
              <Ionicons name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          ) : (
            <Ionicons name="open-outline" size={18} color={colors.muted} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  picker: { gap: spacing.sm },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
    minHeight: 44,
  },
  btnText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  busy: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  busyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },

  list: { gap: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  thumbWrap: { width: 96, height: 96, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  thumb: { width: "100%", height: "100%" },
  remove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  doc: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  docName: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  docMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
}));
