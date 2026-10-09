import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { AnnouncementCard } from "@/src/components/AnnouncementCard";
import { Header } from "@/src/components/Header";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Announcement, StoreDue } from "@/src/types";

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
  const queryClient = useQueryClient();

  const { data: announcements = [], refetch: refetchAnns, isRefetching: r1 } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api<Announcement[]>("/announcements"),
  });
  const { data: due = [], refetch: refetchDue, isRefetching: r2 } = useQuery({
    queryKey: ["checks-due"],
    queryFn: () => api<StoreDue[]>("/checks/due"),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/announcements/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const [open, setOpen] = useState<string | null>(null);
  const [store, setStore] = useState<string>("");

  // Default to the first store that still has something to do
  useEffect(() => {
    if (!due.length) return;
    if (store && due.some((d) => d.store === store)) return;
    setStore((due.find((d) => d.pending > 0) ?? due[0]).store);
  }, [due, store]);

  const selected = due.find((d) => d.store === store);
  const totalPending = due.reduce((n, d) => n + d.pending, 0);

  const greeting = `Welcome back, ${user?.pref || user?.first || user?.name || ""}`;
  const storesText = user?.co ? "Company Access" : (user?.stores ?? []).join(" · ");

  const onAction = (key: string) => {
    if (key === "checks") router.push("/checks");
    else if (key === "incident") router.push("/incidents");
    else router.push("/training");
  };

  const openAnn = (a: Announcement) => {
    const next = open === a.id ? null : a.id;
    setOpen(next);
    if (next && !a.read) markRead.mutate(a.id);
  };

  const refresh = () => {
    refetchAnns();
    refetchDue();
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={r1 || r2} onRefresh={refresh} tintColor={colors.brand} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.hello}>{greeting}</Text>
          <Text style={styles.sub}>{storesText}</Text>
        </View>

        {/* Pending checks */}
        {due.length > 0 ? (
          <View style={styles.dueCard} testID="pending-checks">
            <View style={styles.dueHead}>
              <Text style={styles.heading}>Pending checks</Text>
              {totalPending > 0 ? (
                <View style={styles.dueTotal}>
                  <Text style={styles.dueTotalText}>{totalPending} to do</Text>
                </View>
              ) : (
                <View style={[styles.dueTotal, styles.dueTotalOk]}>
                  <Ionicons name="checkmark" size={14} color={colors.success} />
                  <Text style={[styles.dueTotalText, { color: colors.success }]}>All done</Text>
                </View>
              )}
            </View>

            {due.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeRow}>
                {due.map((d) => {
                  const on = d.store === store;
                  return (
                    <Pressable key={d.store} onPress={() => setStore(d.store)} style={[styles.storeChip, on && styles.storeChipOn]} testID={`due-store-${d.store}`}>
                      <Text style={[styles.storeChipText, on && styles.storeChipTextOn]}>{d.store}</Text>
                      {d.pending > 0 ? (
                        <View style={[styles.badge, on && styles.badgeOn]}>
                          <Text style={[styles.badgeText, on && styles.badgeTextOn]}>{d.pending}</Text>
                        </View>
                      ) : (
                        <Ionicons name="checkmark-circle" size={16} color={on ? colors.onBrand : colors.success} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <View style={styles.dueList}>
              {selected?.items.map((it) => (
                <Pressable
                  key={it.label}
                  disabled={it.done}
                  onPress={() => router.push({ pathname: "/check/new", params: { store: selected.store, type: it.type, shift: it.shift } })}
                  style={({ pressed }) => [styles.dueItem, it.done && styles.dueItemDone, pressed && !it.done && styles.dueItemPressed]}
                  testID={`due-item-${it.type}-${it.shift || "none"}`}
                >
                  <Ionicons name={it.done ? "checkmark-circle" : "ellipse-outline"} size={22} color={it.done ? colors.success : colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dueItemText, it.done && styles.dueItemTextDone]}>{it.label}</Text>
                    <Text style={styles.dueItemMeta}>{it.freq === "daily" ? "Every day" : "Once a month"}{it.done ? " · Done" : ""}</Text>
                  </View>
                  {!it.done ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

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
          {announcements.length === 0 ? <Text style={styles.none}>No announcements right now.</Text> : null}
          {announcements.map((a, i) => (
            <AnnouncementCard key={a.id} announcement={a} expanded={open === a.id} onToggle={() => openAnn(a)} testID={`announcement-${i}`} />
          ))}
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

  heroCard: { backgroundColor: colors.surfaceInverse, borderRadius: radius.md, padding: spacing.xl, gap: spacing.xs },
  hello: { fontFamily: fonts.semibold, fontSize: 24, color: colors.onSurfaceInverse },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.onSurfaceInverse, opacity: 0.8 },

  dueCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  dueHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dueTotal: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  dueTotalOk: { backgroundColor: colors.surfaceTertiary },
  dueTotalText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onBrand },
  storeRow: { gap: spacing.sm },
  storeChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.brand, minHeight: 40 },
  storeChipOn: { backgroundColor: colors.brand },
  storeChipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  storeChipTextOn: { color: colors.onBrand },
  badge: { minWidth: 20, height: 20, borderRadius: radius.pill, paddingHorizontal: 5, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  badgeOn: { backgroundColor: colors.onBrand },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.onBrand },
  badgeTextOn: { color: colors.brand },
  dueList: { gap: spacing.xs },
  dueItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.sm, minHeight: 48 },
  dueItemDone: { opacity: 0.6 },
  dueItemPressed: { backgroundColor: colors.surfaceTertiary },
  dueItemText: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface },
  dueItemTextDone: { textDecorationLine: "line-through", color: colors.muted },
  dueItemMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },

  actions: { gap: spacing.md },
  action: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg },
  actionPressed: { borderColor: colors.brand, opacity: 0.95 },
  actionIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1 },
  actionTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface },
  actionSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },

  heading: { fontFamily: fonts.semibold, fontSize: 20, color: colors.onSurface },
  annList: { gap: spacing.sm },
  none: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
}));
