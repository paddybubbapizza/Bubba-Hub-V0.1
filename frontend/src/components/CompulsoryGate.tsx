import { Modal, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { AttachmentList } from "@/src/components/Attachments";
import { Button, Pill } from "@/src/components/ui";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Announcement } from "@/src/types";

/** Blocks the app until every unread "must read" announcement has been acknowledged. */
export function CompulsoryGate() {
  const { user } = useAuth();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: anns = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api<Announcement[]>("/announcements"),
    enabled: !!user,
  });
  const pending = anns.filter((a) => a.compulsory && !a.read);
  const current = pending[0];

  const ack = useMutation({
    mutationFn: (id: string) => api(`/announcements/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  if (!current) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]} testID="compulsory-gate">
        <View style={styles.banner}>
          <Ionicons name="alert-circle" size={22} color={colors.onBrand} />
          <Text style={styles.bannerText}>
            Please read before continuing{pending.length > 1 ? ` · ${pending.length} to go` : ""}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.pills}>
            <Pill label="Compulsory" tone="error" />
            <Pill label={current.urgency} tone={current.urgency === "Urgent" ? "error" : current.urgency === "Important" ? "warning" : "muted"} />
            <Pill label={current.category} />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.meta}>
            {current.author} · {current.dateLabel}
          </Text>
          <Text style={styles.body}>{current.body}</Text>
          <AttachmentList files={current.attachments} />
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button
            title="I've read this"
            icon="checkmark-circle"
            onPress={() => ack.mutate(current.id)}
            loading={ack.isPending}
            testID="compulsory-ack-button"
          />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onBrand, flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["2xl"] },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  title: { fontFamily: fonts.semibold, fontSize: 24, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
}));
