import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { Button, EmptyState, Pill, StatusBadge } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Check, CheckStatus } from "@/src/types";

type StatusFilter = "all" | CheckStatus;

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Awaiting", value: "awaiting" },
  { label: "Approved", value: "approved" },
  { label: "Returned", value: "returned" },
];

export default function Checks() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [store, setStore] = useState<string>("All");

  const canReview = user?.role !== "Staff";
  const stores = user?.stores ?? [];
  const storesText = user?.co ? `All ${stores.length} stores` : stores.join(" · ");

  const {
    data: checks = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({ queryKey: ["checks"], queryFn: () => api<Check[]>("/checks") });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "return" }) =>
      api<Check>(`/checks/${id}/review`, { method: "POST", body: { action } }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      toast(v.action === "approve" ? "Check approved" : "Check returned", "success");
    },
    onError: (e: any) => toast(e?.message ?? "Could not update the check", "error"),
  });

  const awaitingCount = useMemo(
    () => checks.filter((c) => c.status === "awaiting").length,
    [checks],
  );

  const visible = useMemo(
    () =>
      checks.filter(
        (c) => (status === "all" || c.status === status) && (store === "All" || c.store === store),
      ),
    [checks, status, store],
  );

  const storeChips = ["All", ...stores];

  return (
    <View style={styles.container}>
      <Header title="Store Checks" subtitle={storesText} />

      {/* Sticky filter chrome */}
      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {STATUS_FILTERS.map((f) => {
            const on = status === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setStatus(f.value)}
                style={[styles.chip, on && styles.chipOn]}
                testID={`status-chip-${f.value}`}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                {f.value === "awaiting" && awaitingCount > 0 ? (
                  <View style={styles.chipBadge}>
                    <Text style={styles.chipBadgeText}>{awaitingCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        {stores.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {storeChips.map((s) => {
              const on = store === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setStore(s)}
                  style={[styles.chip, styles.chipAlt, on && styles.chipAltOn]}
                  testID={`store-chip-${s}`}
                >
                  <Text style={[styles.chipAltText, on && styles.chipAltTextOn]}>
                    {s === "All" ? "All stores" : s}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />
        }
      >
        {isLoading ? null : visible.length === 0 ? (
          <EmptyState
            title="No store checks yet"
            message="Start an open or close check and it will show up here for review."
            action={<Button title="New Store Check" icon="add" onPress={() => router.push("/check/new")} />}
          />
        ) : (
          visible.map((c) => (
            <View key={c.id} style={styles.row} testID={`check-row-${c.id}`}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>
                  {c.store}: {c.type}
                  {c.shift ? ` (${c.shift})` : ""}
                </Text>
              </View>
              <Text style={styles.rowMeta}>
                {c.by} · {c.dateLabel} · {c.done} of {c.total}{" "}
                {c.k === "t" ? "readings in range" : "items done"}
              </Text>
              {c.bad > 0 ? (
                <View style={styles.rowPills}>
                  <Pill label={`${c.bad} out of range`} tone="error" />
                </View>
              ) : null}
              <View style={styles.rowBottom}>
                {canReview && c.status === "awaiting" ? (
                  <View style={styles.reviewActions}>
                    <Button
                      title="Approve"
                      small
                      onPress={() => review.mutate({ id: c.id, action: "approve" })}
                      testID={`approve-${c.id}`}
                    />
                    <Button
                      title="Return"
                      small
                      variant="outline"
                      onPress={() => review.mutate({ id: c.id, action: "return" })}
                      testID={`return-${c.id}`}
                    />
                  </View>
                ) : (
                  <StatusBadge status={c.status} rev={c.rev} />
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, { bottom: spacing.lg }, pressed && styles.fabPressed]}
        onPress={() => router.push("/check/new")}
        testID="new-check-fab"
        accessibilitylabel="New store check"
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  filters: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", height: 48 },
  chip: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: "transparent",
  },
  chipOn: { backgroundColor: colors.brand },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  chipTextOn: { color: colors.onBrand },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    backgroundColor: colors.onBrand,
    alignItems: "center",
    justifyContent: "center",
  },
  chipBadgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brand },
  chipAlt: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  chipAltOn: { borderColor: colors.onSurface, backgroundColor: colors.surfaceInverse },
  chipAltText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  chipAltTextOn: { color: colors.onSurfaceInverse },

  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"] + 56, gap: spacing.sm },
  row: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  rowTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface, flex: 1 },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  rowPills: { flexDirection: "row" },
  rowBottom: { flexDirection: "row", marginTop: spacing.xs },
  reviewActions: { flexDirection: "row", gap: spacing.sm },

  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.9 },
}));
