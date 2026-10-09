import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { IncidentStatusBadge, UrgencyPill } from "@/src/components/IncidentBits";
import { Button, EmptyState, Pill } from "@/src/components/ui";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Incident } from "@/src/types";

export default function Incidents() {
  const { user } = useAuth();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();

  const storesText = user?.co ? "Company Access" : (user?.stores ?? []).join(" · ");
  const stores = user?.stores ?? [];
  const [storeFilter, setStoreFilter] = useState<string>("All");

  const { data: all = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api<Incident[]>("/incidents"),
  });
  const incidents = useMemo(() => (storeFilter === "All" ? all : all.filter((i) => i.store === storeFilter)), [all, storeFilter]);
  const countFor = (s: string) => (s === "All" ? all.length : all.filter((i) => i.store === s).length);

  const pending = useMemo(() => incidents.filter((i) => i.status === "pending"), [incidents]);
  const completed = useMemo(() => incidents.filter((i) => i.status === "completed"), [incidents]);

  const renderRow = (i: Incident) => (
    <Pressable
      key={i.id}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/incident/${i.id}`)}
      testID={`incident-row-${i.id}`}
    >
      <View style={styles.rowTop}>
        <UrgencyPill urgency={i.urgency} />
        <Text style={styles.rowType}>{i.type}</Text>
        {i.followUp ? <Pill label="Follow-up" tone="warning" /> : null}
      </View>
      <Text style={styles.rowTitle} numberOfLines={2}>
        {i.description}
      </Text>
      <Text style={styles.rowMeta}>
        {i.store} · {i.by} · {i.dateLabel}
      </Text>
      <View style={styles.rowBottom}>
        <IncidentStatusBadge incident={i} />
        <View style={styles.viewBtn}>
          <Text style={styles.viewText}>View</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brand} />
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Header title="Incident Reports" subtitle={storesText} showBack onBack={() => router.back()} />

      {stores.length > 1 ? (
        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {["All", ...stores].map((s) => {
              const on = storeFilter === s;
              const n = countFor(s);
              return (
                <Pressable key={s} onPress={() => setStoreFilter(s)} style={[styles.chip, on && styles.chipOn]} testID={`incident-store-${s}`}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{s === "All" ? "All stores" : s}</Text>
                  {n > 0 ? (
                    <View style={[styles.chipBadge, on && styles.chipBadgeOn]}>
                      <Text style={[styles.chipBadgeText, on && styles.chipBadgeTextOn]}>{n}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      >
        <Button title="New Incident Report" icon="add" onPress={() => router.push("/incident/new")} testID="new-incident-button" />

        {isLoading ? null : incidents.length === 0 ? (
          <EmptyState
            icon="warning"
            title="No incident reports yet"
            message="Log an accident, injury or issue and your manager will be able to review it here."
          />
        ) : (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Pending review</Text>
              <View style={styles.count}>
                <Text style={styles.countText}>{pending.length}</Text>
              </View>
            </View>
            {pending.length === 0 ? (
              <Text style={styles.none}>Nothing waiting on review.</Text>
            ) : (
              pending.map(renderRow)
            )}

            <View style={[styles.sectionHead, { marginTop: spacing.md }]}>
              <Text style={styles.sectionTitle}>Completed</Text>
              <View style={[styles.count, styles.countMuted]}>
                <Text style={[styles.countText, styles.countTextMuted]}>{completed.length}</Text>
              </View>
            </View>
            {completed.length === 0 ? (
              <Text style={styles.none}>No completed reports yet.</Text>
            ) : (
              completed.map(renderRow)
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  filters: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", height: 56 },
  chip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.brand },
  chipOn: { backgroundColor: colors.brand },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  chipTextOn: { color: colors.onBrand },
  chipBadge: { minWidth: 20, height: 20, borderRadius: radius.pill, paddingHorizontal: 5, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  chipBadgeOn: { backgroundColor: colors.onBrand },
  chipBadgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.onBrand },
  chipBadgeTextOn: { color: colors.brand },
  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.onSurface },
  count: { minWidth: 22, height: 22, borderRadius: radius.pill, paddingHorizontal: 6, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  countMuted: { backgroundColor: colors.surfaceTertiary },
  countText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onBrand },
  countTextMuted: { color: colors.muted },
  none: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, paddingVertical: spacing.sm },

  row: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  rowPressed: { borderColor: colors.brand },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  rowType: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  rowTitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.onSurface },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.xs },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
}));
