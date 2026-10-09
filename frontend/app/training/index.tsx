import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { EmptyState } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { TrainingCategory, TrainingPerson, TrainingProgress } from "@/src/types";

export default function Training() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const isStaff = user?.role === "Staff";
  const [personId, setPersonId] = useState<string>(isStaff ? "me" : "");
  const [openCat, setOpenCat] = useState<string | null>(null);

  const { data: catalogue = [] } = useQuery({ queryKey: ["training-catalogue"], queryFn: () => api<TrainingCategory[]>("/training/catalogue") });
  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ["training-people"],
    queryFn: () => api<TrainingPerson[]>("/training/people"),
    enabled: !isStaff,
  });
  const { data: progress } = useQuery({
    queryKey: ["training", personId],
    queryFn: () => api<TrainingProgress>(`/training/${personId}`),
    enabled: !!personId,
  });

  useEffect(() => {
    if (catalogue.length && !openCat) setOpenCat(catalogue[0].key);
  }, [catalogue, openCat]);

  const toggle = useMutation({
    mutationFn: ({ task, done }: { task: string; done: boolean }) =>
      api(`/training/${personId}/toggle`, { method: "POST", body: { task, done } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training", personId] });
      queryClient.invalidateQueries({ queryKey: ["training-people"] });
    },
    onError: (e: any) => toast(e?.message ?? "Could not update training", "error"),
  });

  const onTask = (taskKey: string, name: string, done: boolean) => {
    if (!progress?.canEdit) return;
    if (!done) {
      toggle.mutate({ task: taskKey, done: true });
      return;
    }
    const go = () => toggle.mutate({ task: taskKey, done: false });
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Un-tick "${name}"? Training is meant to be final once signed off.`)) go();
      return;
    }
    Alert.alert(`Un-tick "${name}"?`, "Training is meant to be final once signed off. Only do this if it was ticked by mistake.", [
      { text: "Keep it ticked", style: "cancel" },
      { text: "Un-tick", style: "destructive", onPress: go },
    ]);
  };

  const total = catalogue.reduce((n, c) => n + c.tasks.length, 0);
  const doneCount = progress ? Object.keys(progress.done).length : 0;
  const subtitle = isStaff ? "Your training record" : "Sign off training for your team";

  return (
    <View style={styles.container}>
      <Header title="Training" subtitle={subtitle} showBack onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* People picker (managers and above) */}
        {!isStaff ? (
          <View style={styles.block}>
            <Text style={styles.label}>Who are you training?</Text>
            {peopleLoading ? null : people.length === 0 ? (
              <Text style={styles.hint}>No staff or managers at your stores yet. Add them under Manage → Accounts.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
                {people.map((p) => {
                  const on = personId === p.id;
                  const complete = p.done >= p.total;
                  return (
                    <Pressable key={p.id} onPress={() => setPersonId(p.id)} style={[styles.person, on && styles.personOn]} testID={`training-person-${p.id}`}>
                      <Text style={[styles.personName, on && styles.personNameOn]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[styles.personMeta, on && styles.personMetaOn]}>
                        {p.role} · {complete ? "Complete" : `${p.done}/${p.total}`}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => setPersonId("me")} style={[styles.person, personId === "me" && styles.personOn]} testID="training-person-me">
                  <Text style={[styles.personName, personId === "me" && styles.personNameOn]}>My record</Text>
                  <Text style={[styles.personMeta, personId === "me" && styles.personMetaOn]}>View only</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        ) : null}

        {!personId ? (
          <EmptyState icon="school" title="Pick a team member" message="Choose someone above to see and sign off their training." />
        ) : progress ? (
          <>
            <View style={styles.progressCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressName}>{progress.user.name}</Text>
                <Text style={styles.progressMeta}>
                  {doneCount} of {total} tasks signed off
                  {progress.canEdit ? "" : " · view only"}
                </Text>
              </View>
              <View style={styles.ring}>
                <Text style={styles.ringText}>{total ? Math.round((doneCount / total) * 100) : 0}%</Text>
              </View>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${total ? (doneCount / total) * 100 : 0}%` }]} />
            </View>

            {catalogue.map((cat) => {
              const catDone = cat.tasks.filter((t) => progress.done[t.key]).length;
              const isOpen = openCat === cat.key;
              return (
                <View key={cat.key} style={styles.cat}>
                  <Pressable style={styles.catHead} onPress={() => setOpenCat(isOpen ? null : cat.key)} testID={`training-cat-${cat.key}`}>
                    <View style={styles.catIcon}>
                      <Ionicons name={cat.icon as any} size={22} color={colors.onBrand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catTitle}>{cat.name}</Text>
                      <Text style={styles.catMeta}>
                        {catDone} of {cat.tasks.length} done
                      </Text>
                    </View>
                    {catDone === cat.tasks.length ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : null}
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
                  </Pressable>
                  {isOpen
                    ? cat.tasks.map((t) => {
                        const d = progress.done[t.key];
                        return (
                          <Pressable
                            key={t.key}
                            onPress={() => onTask(t.key, t.name, !!d)}
                            disabled={!progress.canEdit}
                            style={styles.task}
                            testID={`training-task-${t.key}`}
                          >
                            <View style={[styles.box, !!d && styles.boxOn, !progress.canEdit && !d && styles.boxDisabled]}>
                              {d ? <Ionicons name="checkmark" size={16} color={colors.onBrand} /> : null}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.taskName, !!d && styles.taskNameDone]}>{t.name}</Text>
                              <Text style={styles.taskDesc}>{t.desc}</Text>
                              {d ? (
                                <Text style={styles.taskSigned}>
                                  Signed off by {d.by}
                                  {d.dateLabel ? ` · ${d.dateLabel}` : ""}
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })
                    : null}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md },
  block: { gap: spacing.sm },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  peopleRow: { gap: spacing.sm },
  person: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, minHeight: 48, justifyContent: "center", maxWidth: 180 },
  personOn: { borderColor: colors.brand, backgroundColor: colors.brand },
  personName: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  personNameOn: { color: colors.onBrand },
  personMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  personMetaOn: { color: colors.onBrand, opacity: 0.85 },

  progressCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceInverse, borderRadius: radius.md, padding: spacing.lg },
  progressName: { fontFamily: fonts.semibold, fontSize: 18, color: colors.onSurfaceInverse },
  progressMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurfaceInverse, opacity: 0.8, marginTop: 2 },
  ring: { width: 56, height: 56, borderRadius: radius.pill, borderWidth: 3, borderColor: colors.brand, alignItems: "center", justifyContent: "center" },
  ringText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurfaceInverse },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.brand },

  cat: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" },
  catHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  catIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  catTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface },
  catMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 1 },
  task: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  box: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", marginTop: 2 },
  boxOn: { backgroundColor: colors.success, borderColor: colors.success },
  boxDisabled: { opacity: 0.4 },
  taskName: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface },
  taskNameDone: { color: colors.muted },
  taskDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  taskSigned: { fontFamily: fonts.medium, fontSize: 12, color: colors.success, marginTop: 4 },
}));
