import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { AttachmentList } from "@/src/components/Attachments";
import { Card, Pill } from "@/src/components/ui";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Announcement } from "@/src/types";

export function useUrgencyTone() {
  const { colors } = useTheme();
  return (u: string) => (u === "Urgent" ? colors.error : u === "Important" ? colors.warning : colors.muted);
}

type Props = {
  announcement: Announcement;
  expanded?: boolean;
  onToggle?: () => void;
  actions?: React.ReactNode;
  testID?: string;
};

export function AnnouncementCard({ announcement: a, expanded, onToggle, actions, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tone = useUrgencyTone()(a.urgency);
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = expanded ?? localOpen;
  const toggle = onToggle ?? (() => setLocalOpen((v) => !v));

  return (
    <Card accent={a.urgency === "Urgent"} style={styles.card}>
      <Pressable style={styles.head} onPress={toggle} testID={testID}>
        <View style={styles.headLeft}>
          <View style={styles.titleRow}>
            {a.compulsory && !a.read ? <Ionicons name="alert-circle" size={18} color={colors.error} /> : null}
            <Text style={[styles.title, !a.read && styles.titleUnread]} numberOfLines={isOpen ? undefined : 2}>
              {a.title}
            </Text>
          </View>
          <Text style={styles.meta}>
            {a.author} · {a.dateLabel}
          </Text>
        </View>
        <View style={[styles.urgency, { borderColor: tone }]}>
          <Text style={[styles.urgencyText, { color: tone }]}>{a.urgency === "Normal" ? a.category : a.urgency}</Text>
        </View>
      </Pressable>

      {isOpen ? (
        <View style={styles.body}>
          <Text style={styles.bodyText}>{a.body}</Text>
          <AttachmentList files={a.attachments} />
          {actions}
        </View>
      ) : null}

      <View style={styles.labels}>
        {a.urgency === "Normal" ? null : <Pill label={a.category} />}
        {a.labels.map((l) => (
          <Pill key={l} label={l} tone={l === "Compulsory" ? "error" : l.endsWith("Only") ? "warning" : "muted"} />
        ))}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { padding: 0, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.sm },
  headLeft: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface, flexShrink: 1 },
  titleUnread: { fontFamily: fonts.semibold },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  urgency: { borderWidth: 1, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.md },
  urgencyText: { fontFamily: fonts.medium, fontSize: 12 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm },
  bodyText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.onSurfaceSecondary },
  labels: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.xs },
}));
