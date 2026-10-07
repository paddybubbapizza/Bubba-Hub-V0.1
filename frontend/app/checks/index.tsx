import { useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { Button, EmptyState, Pill, StatusBadge } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Check, CheckStatus, Template } from "@/src/types";

type StatusFilter = "all" | CheckStatus;

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Awaiting", value: "awaiting" },
  { label: "Approved", value: "approved" },
  { label: "Returned", value: "returned" },
];

export default function ChecksList() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const filterSheet = useRef<BottomSheetModal>(null);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [store, setStore] = useState<string>("All");
  const [type, setType] = useState<string>("All");

  const canReview = user?.role !== "Staff";
  const stores = user?.stores ?? [];
  const storesText = user?.co ? "Company access" : stores.join(" · ");

  const { data: checks = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["checks"],
    queryFn: () => api<Check[]>("/checks"),
  });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => api<Template[]>("/templates") });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "return" }) =>
      api<Check>(`/checks/${id}/review`, { method: "POST", body: { action } }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      toast(v.action === "approve" ? "Check approved" : "Check returned", "success");
    },
    onError: (e: any) => toast(e?.message ?? "Could not update the check", "error"),
  });

  const awaitingCount = useMemo(() => checks.filter((c) => c.status === "awaiting").length, [checks]);

  const visible = useMemo(
    () =>
      checks.filter(
        (c) =>
          (status === "all" || c.status === status) &&
          (store === "All" || c.store === store) &&
          (type === "All" || c.type === type),
      ),
    [checks, status, store, type],
  );

  const activeFilters = (store !== "All" ? 1 : 0) + (type !== "All" ? 1 : 0);
  const storeChips = ["All", ...stores];
  const typeChips = ["All", ...templates.map((t) => t.name)];

  return (
    <View style={styles.container}>
      <Header title="Store Checks" subtitle={storesText} showBack onBack={() => router.back()} />

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {STATUS_FILTERS.map((f) => {
            const on = status === f.value;
            return (
              <Pressable key={f.value} onPress={() => setStatus(f.value)} style={[styles.chip, on && styles.chipOn]} testID={`status-chip-${f.value}`}>
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
        <Pressable style={styles.filterBtn} onPress={() => filterSheet.current?.present()} testID="filters-button">
          <Ionicons name="options" size={18} color={colors.brand} />
          <Text style={styles.filterBtnText}>Filters</Text>
          {activeFilters > 0 ? (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{activeFilters}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
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
                {c.bad > 0 ? (
                  <Ionicons name="alert-circle" size={20} color={colors.error} style={styles.alertIcon} testID={`alert-${c.id}`} />
                ) : null}
                <Text style={styles.rowTitle}>
                  {c.store}: {c.type}
                  {c.shift ? ` (${c.shift})` : ""}
                </Text>
              </View>
              <Text style={styles.rowMeta}>
                {c.by} · {c.dateLabel} · {c.done} of {c.total} {c.k === "t" ? "readings in range" : "items done"}
              </Text>
              {c.bad > 0 ? (
                <View style={styles.rowPills}>
                  <Pill label={`${c.bad} out of range`} tone="error" />
                </View>
              ) : null}
              <View style={styles.rowBottom}>
                <StatusBadge status={c.status} rev={c.rev} />
                <View style={styles.reviewActions}>
                  <Button title="View" small variant="ghost" icon="eye-outline" onPress={() => router.push(`/check/${c.id}`)} testID={`view-${c.id}`} />
                  {canReview && c.status === "awaiting" ? (
                    <>
                      <Button title="Approve" small onPress={() => review.mutate({ id: c.id, action: "approve" })} testID={`approve-${c.id}`} />
                      <Button title="Return" small variant="outline" onPress={() => review.mutate({ id: c.id, action: "return" })} testID={`return-${c.id}`} />
                    </>
                  ) : null}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} onPress={() => router.push("/check/new")} testID="new-check-fab">
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>

      <BottomSheetModal
        ref={filterSheet}
        enableDynamicSizing
        backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backdropComponent={(p) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />}
      >
        <BottomSheetView style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filters</Text>
            {activeFilters > 0 ? (
              <Pressable onPress={() => { setStore("All"); setType("All"); }} testID="clear-filters">
                <Text style={styles.clear}>Clear all</Text>
              </Pressable>
            ) : null}
          </View>

          {stores.length > 1 ? (
            <View style={styles.sheetBlock}>
              <Text style={styles.sheetLabel}>Store</Text>
              <View style={styles.wrapRow}>
                {storeChips.map((s) => {
                  const on = store === s;
                  return (
                    <Pressable key={s} onPress={() => setStore(s)} style={[styles.sheetChip, on && styles.sheetChipOn]} testID={`filter-store-${s}`}>
                      <Text style={[styles.sheetChipText, on && styles.sheetChipTextOn]}>{s === "All" ? "All stores" : s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.sheetBlock}>
            <Text style={styles.sheetLabel}>Check type</Text>
            <View style={styles.wrapRow}>
              {typeChips.map((t) => {
                const on = type === t;
                return (
                  <Pressable key={t} onPress={() => setType(t)} style={[styles.sheetChip, on && styles.sheetChipOn]} testID={`filter-type-${t}`}>
                    <Text style={[styles.sheetChipText, on && styles.sheetChipTextOn]}>{t === "All" ? "All types" : t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Button title="Show results" onPress={() => filterSheet.current?.dismiss()} testID="apply-filters" />
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center", height: 56 },
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
  },
  chipOn: { backgroundColor: colors.brand },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  chipTextOn: { color: colors.onBrand },
  chipBadge: { minWidth: 20, height: 20, borderRadius: radius.pill, paddingHorizontal: 5, backgroundColor: colors.onBrand, alignItems: "center", justifyContent: "center" },
  chipBadgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brand },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginRight: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  filterBtnText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  filterCount: { minWidth: 18, height: 18, borderRadius: radius.pill, paddingHorizontal: 4, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  filterCountText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.onBrand },

  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"] + 56, gap: spacing.sm },
  row: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  alertIcon: { marginRight: 2 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface, flex: 1 },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  rowPills: { flexDirection: "row" },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  reviewActions: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },

  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
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

  sheet: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["2xl"] },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 20, color: colors.onSurface },
  clear: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  sheetBlock: { gap: spacing.sm },
  sheetLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sheetChip: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  sheetChipOn: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  sheetChipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSurface },
  sheetChipTextOn: { color: colors.onBrandTertiary },
}));
