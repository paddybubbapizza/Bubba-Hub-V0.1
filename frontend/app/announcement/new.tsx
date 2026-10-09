import { useEffect, useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { AttachmentPicker } from "@/src/components/Attachments";
import { Header } from "@/src/components/Header";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Announcement, AnnouncementOptions, FileRef, Store } from "@/src/types";

const URGENCY_HINT: Record<string, string> = {
  Normal: "Regular update. Shows in the feed.",
  Important: "Highlighted so people notice it.",
  Urgent: "Red banner at the top of everyone's home screen.",
};

export default function NewAnnouncement() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: options } = useQuery({ queryKey: ["announcement-options"], queryFn: () => api<AnnouncementOptions>("/announcements/options") });
  const { data: allStores = [] } = useQuery({ queryKey: ["stores"], queryFn: () => api<Store[]>("/stores"), enabled: !!user?.co });
  const { data: anns = [] } = useQuery({ queryKey: ["announcements"], queryFn: () => api<Announcement[]>("/announcements"), enabled: !!id });
  const editing = id ? anns.find((a) => a.id === id) : undefined;

  const storeChoices = user?.co ? allStores.map((s) => s.name) : (user?.stores ?? []);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [category, setCategory] = useState("General");
  const [roles, setRoles] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [compulsory, setCompulsory] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [files, setFiles] = useState<FileRef[]>([]);
  const [touched, setTouched] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!editing || loaded) return;
    setTitle(editing.title);
    setBody(editing.body);
    setUrgency(editing.urgency);
    setCategory(editing.category);
    setRoles(editing.audienceRoles);
    setStores(editing.stores);
    setCompulsory(editing.compulsory);
    setTags(editing.tags);
    setFiles(editing.attachments);
    setLoaded(true);
  }, [editing, loaded]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title, body, urgency, category, tags, audienceRoles: roles, stores, compulsory,
        attachments: files.map((f) => f.id),
      };
      return id
        ? api<Announcement>(`/announcements/${id}`, { method: "PATCH", body: payload })
        : api<Announcement>("/announcements", { method: "POST", body: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast(id ? "Announcement updated" : "Announcement posted", "success");
      router.back();
    },
    onError: (e: any) => toast(e?.message ?? "Could not save the announcement", "error"),
  });

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t) return;
    if (!tags.includes(t) && tags.length < 8) setTags([...tags, t]);
    setTagDraft("");
  };

  const onSubmit = () => {
    setTouched(true);
    if (!title.trim()) return toast("Give the announcement a title", "error");
    if (!body.trim()) return toast("Write the announcement message", "error");
    save.mutate();
  };

  const roleLabel = (r: string) => (r === "Franchisee" ? "Franchisees" : r === "Manager" ? "Managers" : "Staff");

  return (
    <View style={styles.container}>
      <Header title={id ? "Edit Announcement" : "New Announcement"} showBack onBack={() => router.back()} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing["3xl"] }]}
        bottomOffset={90}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Short and clear" error={touched && !title.trim() ? "Add a title." : undefined} testID="ann-title" />
        <Field
          label="Message"
          value={body}
          onChangeText={setBody}
          placeholder="What does the team need to know?"
          multiline
          textAlignVertical="top"
          style={styles.multiline}
          error={touched && !body.trim() ? "Write the message." : undefined}
          testID="ann-body"
        />

        <View style={styles.block}>
          <Text style={styles.label}>Urgency</Text>
          <View style={styles.row}>
            {(options?.urgencies ?? ["Normal", "Important", "Urgent"]).map((u) => {
              const on = urgency === u;
              const color = u === "Urgent" ? colors.error : u === "Important" ? colors.warning : colors.brand;
              return (
                <Pressable key={u} onPress={() => setUrgency(u)} style={[styles.seg, { borderColor: color }, on && { backgroundColor: color }]} testID={`ann-urgency-${u}`}>
                  <Text style={[styles.segText, { color: on ? colors.onBrand : color }]}>{u}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{URGENCY_HINT[urgency]}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.wrapRow}>
            {(options?.categories ?? []).map((c) => {
              const on = category === c;
              return (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.pick, on && styles.pickOn]} testID={`ann-category-${c}`}>
                  <Text style={[styles.pickText, on && styles.pickTextOn]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>
            Who can read it <Text style={styles.optional}>(leave empty for everyone)</Text>
          </Text>
          <View style={styles.wrapRow}>
            {(options?.roles ?? []).map((r) => {
              const on = roles.includes(r);
              return (
                <Pressable key={r} onPress={() => toggle(roles, setRoles, r)} style={[styles.pick, on && styles.pickOn]} testID={`ann-role-${r}`}>
                  {on ? <Ionicons name="checkmark" size={14} color={colors.onBrand} /> : null}
                  <Text style={[styles.pickText, on && styles.pickTextOn]}>{roleLabel(r)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{roles.length === 0 ? "Everyone with access will see this." : `Only ${roles.map(roleLabel).join(", ")} will see this.`}</Text>
        </View>

        {storeChoices.length > 1 ? (
          <View style={styles.block}>
            <Text style={styles.label}>
              Stores <Text style={styles.optional}>(leave empty for {user?.co ? "all stores" : "all your stores"})</Text>
            </Text>
            <View style={styles.wrapRow}>
              {storeChoices.map((s) => {
                const on = stores.includes(s);
                return (
                  <Pressable key={s} onPress={() => toggle(stores, setStores, s)} style={[styles.pick, on && styles.pickOn]} testID={`ann-store-${s}`}>
                    <Text style={[styles.pickText, on && styles.pickTextOn]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.label}>Tags</Text>
          <View style={styles.tagRow}>
            <TextInput
              style={styles.tagInput}
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={addTag}
              placeholder="e.g. Recall, New menu"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              testID="ann-tag-input"
            />
            <Button title="Add" small variant="outline" onPress={addTag} testID="ann-tag-add" />
          </View>
          {tags.length ? (
            <View style={styles.wrapRow}>
              {tags.map((t) => (
                <Pressable key={t} onPress={() => setTags(tags.filter((x) => x !== t))} style={styles.tag} testID={`ann-tag-${t}`}>
                  <Text style={styles.tagText}>{t}</Text>
                  <Ionicons name="close" size={14} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Attachments</Text>
          <AttachmentPicker files={files} onChange={setFiles} testID="ann-attachments" />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Must read before continuing</Text>
            <Text style={styles.hint}>People have to open and acknowledge this before using the app.</Text>
          </View>
          <Switch value={compulsory} onValueChange={setCompulsory} trackColor={{ true: colors.brand, false: colors.borderStrong }} thumbColor={colors.surface} testID="ann-compulsory" />
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button title={id ? "Save changes" : "Post announcement"} onPress={onSubmit} loading={save.isPending} testID="submit-announcement-button" />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.xl },
  block: { gap: spacing.sm },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  optional: { fontFamily: fonts.regular, color: colors.muted },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  multiline: { minHeight: 120, paddingTop: 11 },
  row: { flexDirection: "row", gap: spacing.sm },
  seg: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 2, alignItems: "center" },
  segText: { fontFamily: fonts.semibold, fontSize: 13 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pick: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 9, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.brand },
  pickOn: { backgroundColor: colors.brand },
  pickText: { fontFamily: fonts.medium, fontSize: 13, color: colors.brand },
  pickTextOn: { color: colors.onBrand },
  tagRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  tagInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.onSurface,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
  },
  tag: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  tagText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSurface },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  footer: { backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
}));
