import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { Card, Pill } from "@/src/components/ui";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Announcement } from "@/src/types";

const QUICK_ACTIONS = [
  { key: "checks", title: "Store Checks", sub: "Daily open and close checklists", icon: "clipboard" },
  { key: "incident", title: "Incident Reports", sub: "Log an accident, injury or issue", icon: "warning" },
  { key: "training", title: "Training", sub: "Courses and how-to guides", icon: "school" },
] as const;

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api<Announcement[]>("/announcements"),
  });

  const [open, setOpen] = useState<number | null>(0);

  const greeting = `Welcome back, ${user?.pref || user?.first || user?.name || ""}`;
  const storesText = user?.co ? "Company access" : (user?.stores ?? []).join(" · ");

  const onAction = (key: string) => {
    if (key === "checks") {
      router.push("/checks");
    } else if (key === "incident") {
      router.push("/incidents");
    } else {
      router.push("/training");
    }
  };

  return (
    <View style={styles.container}>
      <Header
        logo
        right={
          <View style={styles.userChip}>
            <Ionicons name="location" size={14} color={colors.brand} />
            <Text style={styles.userName} numberOfLines={1}>
              {user?.first}
            </Text>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.hello}>{greeting}</Text>
          <Text style={styles.sub}>{storesText}</Text>
        </View>

        <View style={styles.actions}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              onPress={() => onAction(a.key)}
              testID={`home-action-${a.key}`}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={a.icon as any} size={26} color={colors.onBrand} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>{a.title}</Text>
                <Text style={styles.actionSub}>{a.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.heading}>Announcements</Text>
        <View style={styles.annList}>
          {announcements.map((a, i) => {
            const isOpen = open === i;
            return (
              <Card key={i} accent={a.urgent} style={styles.ann}>
                <Pressable
                  style={styles.annHead}
                  onPress={() => setOpen(isOpen ? null : i)}
                  testID={`announcement-${i}`}
                >
                  <View style={styles.annHeadLeft}>
                    <Text style={styles.annTitle}>{a.title}</Text>
                    <Text style={styles.annDate}>{a.dateLabel}</Text>
                  </View>
                  <Pill label={a.tag} tone={a.urgent ? "error" : "muted"} />
                </Pressable>
                {isOpen ? <Text style={styles.annBody}>{a.body}</Text> : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing["2xl"], gap: spacing.lg },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    maxWidth: 140,
  },
  userName: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSurface },

  heroCard: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.md,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  hello: { fontFamily: fonts.semibold, fontSize: 24, color: colors.onSurfaceInverse },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.onSurfaceInverse, opacity: 0.8 },

  actions: { gap: spacing.md },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  actionPressed: { borderColor: colors.brand, opacity: 0.95 },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1 },
  actionTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface },
  actionSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },

  heading: { fontFamily: fonts.semibold, fontSize: 20, color: colors.onSurface },
  annList: { gap: spacing.sm },
  ann: { padding: 0, overflow: "hidden" },
  annHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.lg,
  },
  annHeadLeft: { flex: 1 },
  annTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  annDate: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  annBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceSecondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
}));
