import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { Header } from "@/src/components/Header";
import { Card, Pill, StatusBadge } from "@/src/components/ui";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Check, ItemEntry, TempEntry } from "@/src/types";

export default function CheckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();

  const { data: checks = [] } = useQuery({ queryKey: ["checks"], queryFn: () => api<Check[]>("/checks") });
  const check = checks.find((c) => c.id === id);

  return (
    <View style={styles.container}>
      <Header title="Check Details" showBack onBack={() => router.back()} />
      {!check ? (
        <View style={styles.center}>
          <Text style={styles.muted}>This check could not be found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card style={styles.summary} accent={check.bad > 0}>
            <Text style={styles.title}>
              {check.type}
              {check.shift ? ` (${check.shift})` : ""}
            </Text>
            <Text style={styles.meta}>
              {check.store} · {check.by} · {check.dateLabel}
            </Text>
            <View style={styles.summaryRow}>
              <StatusBadge status={check.status} rev={check.rev} />
              {check.bad > 0 ? <Pill label={`${check.bad} out of range`} tone="error" /> : null}
            </View>
          </Card>

          <Text style={styles.heading}>
            {check.k === "t" ? "Temperature readings" : "Checklist items"}
          </Text>

          <View style={styles.entries}>
            {check.k === "t"
              ? (check.entries as TempEntry[]).map((e, i) => (
                  <View key={i} style={styles.entry} testID={`entry-${i}`}>
                    <View style={styles.entryLeft}>
                      <Ionicons
                        name={e.ok ? "checkmark-circle" : "alert-circle"}
                        size={22}
                        color={e.ok ? colors.success : colors.error}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryName}>{e.name}</Text>
                        <Text style={styles.entryHint}>Target: {e.hint}</Text>
                      </View>
                    </View>
                    <Text style={[styles.entryValue, { color: e.ok ? colors.onSurface : colors.error }]}>
                      {e.value === null ? "—" : `${e.value}°C`}
                    </Text>
                  </View>
                ))
              : (check.entries as ItemEntry[]).map((e, i) => (
                  <View key={i} style={styles.entry} testID={`entry-${i}`}>
                    <View style={styles.entryLeft}>
                      <Ionicons
                        name={e.done ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={e.done ? colors.success : colors.muted}
                      />
                      <Text style={styles.entryName}>{e.name}</Text>
                    </View>
                    <Text style={[styles.entryValue, { color: e.done ? colors.success : colors.muted }]}>
                      {e.done ? "Done" : "Not done"}
                    </Text>
                  </View>
                ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["2xl"] },
  summary: { gap: spacing.sm },
  title: { fontFamily: fonts.semibold, fontSize: 20, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  summaryRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.xs },
  heading: { fontFamily: fonts.semibold, fontSize: 17, color: colors.onSurface },
  entries: { gap: spacing.sm },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  entryLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  entryName: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface, flex: 1 },
  entryHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 1 },
  entryValue: { fontFamily: fonts.semibold, fontSize: 16 },
}));
