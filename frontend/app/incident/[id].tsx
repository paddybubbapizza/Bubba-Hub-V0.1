import { useRef, useState } from "react";
import { Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { IncidentStatusBadge, UrgencyPill } from "@/src/components/IncidentBits";
import { Button, Card, Pill } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Incident } from "@/src/types";

// BottomSheetTextInput is not supported by react-native-web; plain TextInput there.
const NoteInput = Platform.OS === "web" ? TextInput : BottomSheetTextInput;

export default function IncidentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const sheet = useRef<BottomSheetModal>(null);
  const [note, setNote] = useState("");

  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: () => api<Incident[]>("/incidents") });
  const inc = incidents.find((i) => i.id === id);
  const canReview = user?.role !== "Staff";

  const review = useMutation({
    mutationFn: () => api<Incident>(`/incidents/${id}/review`, { method: "POST", body: { note } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      sheet.current?.dismiss();
      toast("Report marked as completed", "success");
    },
    onError: (e: any) => toast(e?.message ?? "Could not complete the report", "error"),
  });

  return (
    <View style={styles.container}>
      <Header title="Incident Report" showBack onBack={() => router.back()} />
      {!inc ? (
        <View style={styles.center}>
          <Text style={styles.muted}>This report could not be found.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Card style={styles.summary} accent={inc.urgency === "High" || inc.urgency === "Critical"}>
              <View style={styles.pills}>
                <UrgencyPill urgency={inc.urgency} />
                {inc.followUp ? <Pill label="Follow-up needed" tone="warning" /> : null}
              </View>
              <Text style={styles.title}>{inc.type}</Text>
              <Text style={styles.meta}>
                {inc.store} · Reported by {inc.by} · {inc.dateLabel}
              </Text>
              <IncidentStatusBadge incident={inc} />
            </Card>

            <Section label="What happened" value={inc.description} testID="inc-detail-description" />
            <Section label="When" value={inc.occurredAt || "Not recorded"} />
            <Section label="Where in the store" value={inc.location || "Not recorded"} />
            <Section label="Actions taken so far" value={inc.actions || "None recorded"} />

            <View style={styles.block}>
              <Text style={styles.label}>Who was involved</Text>
              {inc.involved.length === 0 ? (
                <Text style={styles.value}>No one named</Text>
              ) : (
                <View style={styles.people}>
                  {inc.involved.map((p) => (
                    <View key={p.id} style={styles.person}>
                      <Ionicons name="person-circle-outline" size={20} color={colors.brand} />
                      <Text style={styles.personName}>{p.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {inc.status === "completed" ? (
              <Card style={styles.reviewCard}>
                <View style={styles.reviewHead}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.reviewTitle}>Completed by {inc.rev}</Text>
                </View>
                {inc.reviewedLabel ? <Text style={styles.meta}>{inc.reviewedLabel}</Text> : null}
                <Text style={styles.value} testID="inc-review-note">
                  {inc.revNote || "No review note left."}
                </Text>
              </Card>
            ) : null}
          </ScrollView>

          {canReview && inc.status === "pending" ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
              <Button title="Mark as completed" icon="checkmark-done" onPress={() => sheet.current?.present()} testID="complete-incident-button" />
            </View>
          ) : null}
        </>
      )}

      <BottomSheetModal
        ref={sheet}
        enableDynamicSizing
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backdropComponent={(p) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />}
      >
        <BottomSheetView style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.sheetTitle}>Complete this report</Text>
          <Text style={styles.hint}>Add an optional note about what was done or decided. The reporter will see it.</Text>
          <NoteInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Spoke with the team, technician booked for Friday"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            testID="review-note-input"
          />
          <Button title="Mark as completed" onPress={() => review.mutate()} loading={review.isPending} testID="confirm-complete-button" />
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

function Section({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["3xl"] },
  summary: { gap: spacing.sm },
  pills: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  title: { fontFamily: fonts.semibold, fontSize: 20, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  block: { gap: spacing.xs },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontFamily: fonts.regular, fontSize: 16, color: colors.onSurface, lineHeight: 23 },
  people: { gap: spacing.xs, marginTop: 2 },
  person: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  personName: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface },
  reviewCard: { gap: spacing.xs, borderColor: colors.success },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  reviewTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface },
  footer: { backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  sheet: { padding: spacing.lg, gap: spacing.md },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 20, color: colors.onSurface },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  noteInput: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.onSurface,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    minHeight: 96,
  },
}));
