import { useMemo } from "react";
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

  const storesText = user?.co ? "Company access" : (user?.stores ?? []).join(" · ");

  const { data: incidents = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api<Incident[]>("/incidents"),
  });

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
