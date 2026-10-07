import { useEffect, useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { useUrgencyColor } from "@/src/components/IncidentBits";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Incident, IncidentOptions, Person } from "@/src/types";

const URGENCY_HINT: Record<string, string> = {
  Low: "Minor issue, no one hurt, no risk to trading.",
  Medium: "Needs attention this week or affects service.",
  High: "Someone was hurt or trading is affected today.",
  Critical: "Serious injury, food safety risk or store must close.",
};

function nowDate() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function NewIncident() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const urgencyColor = useUrgencyColor();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const stores = user?.stores ?? [];
  const singleStore = stores.length === 1 ? stores[0] : "";

  const { data: options } = useQuery({
    queryKey: ["incident-options"],
    queryFn: () => api<IncidentOptions>("/incidents/options"),
  });

  const [store, setStore] = useState<string>(singleStore);
  const [urgency, setUrgency] = useState<string>("Medium");
  const [type, setType] = useState<string>("");
  const [involved, setInvolved] = useState<Person[]>([]);
  const [date, setDate] = useState(nowDate());
  const [time, setTime] = useState(nowTime());
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [actions, setActions] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [touched, setTouched] = useState(false);

  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ["store-people", store],
    queryFn: () => api<Person[]>(`/stores/${encodeURIComponent(store)}/people`),
    enabled: !!store,
  });

  // Changing store resets the people picked, since they belong to the old store
  useEffect(() => {
    setInvolved([]);
  }, [store]);

  const togglePerson = (p: Person) =>
    setInvolved((cur) => (cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, { id: p.id, name: p.name }]));

  const submit = useMutation({
    mutationFn: (body: any) => api<Incident>("/incidents", { method: "POST", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast("Incident report submitted", "success");
      router.back();
    },
    onError: (e: any) => toast(e?.message ?? "Could not submit the report", "error"),
  });

  const descriptionShort = description.trim().length < 10;

  const onSubmit = () => {
    setTouched(true);
    if (!store) return toast("Choose a store first", "error");
    if (!type) return toast("Choose the type of incident", "error");
    if (descriptionShort) return toast("Describe what happened", "error");
    submit.mutate({
      store,
      urgency,
      type,
      involved,
      occurredAt: `${date.trim()} ${time.trim()}`.trim(),
      location,
      description,
      actions,
      followUp,
    });
  };

  return (
    <View style={styles.container}>
      <Header title="New Incident Report" showBack onBack={() => router.back()} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing["3xl"] }]}
        bottomOffset={90}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Store */}
        {stores.length > 1 ? (
          <View style={styles.block}>
            <Text style={styles.label}>Store</Text>
            <View style={styles.wrapRow}>
              {stores.map((s) => {
                const on = store === s;
                return (
                  <Pressable key={s} onPress={() => setStore(s)} style={[styles.pick, on && styles.pickOn]} testID={`inc-store-${s}`}>
                    <Text style={[styles.pickText, on && styles.pickTextOn]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
            {touched && !store ? <Text style={styles.error}>Choose a store.</Text> : null}
          </View>
        ) : (
          <View style={styles.block}>
            <Text style={styles.label}>Store</Text>
            <Text style={styles.single}>{singleStore}</Text>
          </View>
        )}

        {/* Urgency */}
        <View style={styles.block}>
          <Text style={styles.label}>Urgency</Text>
          <View style={styles.urgencyRow}>
            {(options?.urgencies ?? ["Low", "Medium", "High", "Critical"]).map((u) => {
              const on = urgency === u;
              const color = urgencyColor(u);
              return (
                <Pressable
                  key={u}
                  onPress={() => setUrgency(u)}
                  style={[styles.urgency, { borderColor: color }, on && { backgroundColor: color }]}
                  testID={`inc-urgency-${u}`}
                >
                  <Text style={[styles.urgencyText, { color: on ? colors.onBrand : color }]}>{u}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{URGENCY_HINT[urgency]}</Text>
        </View>

        {/* Type */}
        <View style={styles.block}>
          <Text style={styles.label}>Type of incident</Text>
          <View style={styles.wrapRow}>
            {(options?.types ?? []).map((t) => {
              const on = type === t;
              return (
                <Pressable key={t} onPress={() => setType(t)} style={[styles.pick, on && styles.pickOn]} testID={`inc-type-${t}`}>
                  <Text style={[styles.pickText, on && styles.pickTextOn]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
          {touched && !type ? <Text style={styles.error}>Choose the type of incident.</Text> : null}
        </View>

        {/* Who was involved */}
        <View style={styles.block}>
          <Text style={styles.label}>
            Who was involved <Text style={styles.optional}>(optional, pick any number)</Text>
          </Text>
          {!store ? (
            <Text style={styles.hint}>Choose a store to see who works there.</Text>
          ) : peopleLoading ? (
            <Text style={styles.hint}>Loading people…</Text>
          ) : people.length === 0 ? (
            <Text style={styles.hint}>No one is registered to {store} yet.</Text>
          ) : (
            <View style={styles.people}>
              {people.map((p) => {
                const on = involved.some((x) => x.id === p.id);
                return (
                  <Pressable key={p.id} onPress={() => togglePerson(p)} style={[styles.person, on && styles.personOn]} testID={`inc-person-${p.id}`}>
                    <View style={[styles.box, on && styles.boxOn]}>
                      {on ? <Ionicons name="checkmark" size={16} color={colors.onBrand} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{p.name}</Text>
                      <Text style={styles.personRole}>{p.role}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* When & where */}
        <View style={styles.block}>
          <Text style={styles.label}>When did it happen?</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
                testID="inc-date"
              />
              <Text style={styles.subLabel}>Date</Text>
            </View>
            <View style={styles.col}>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.muted}
                keyboardType="numbers-and-punctuation"
                testID="inc-time"
              />
              <Text style={styles.subLabel}>Time (24hr)</Text>
            </View>
          </View>
        </View>

        <Field
          label="Where in the store?"
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Make line, front counter, cool room"
          testID="inc-location"
        />

        <View style={styles.block}>
          <Field
            label="What happened?"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the incident clearly. Include what led up to it and the outcome."
            multiline
            textAlignVertical="top"
            style={styles.multiline}
            error={touched && descriptionShort ? "Describe what happened in at least 10 characters." : undefined}
            testID="inc-description"
          />
        </View>

        <Field
          label="Actions taken so far"
          value={actions}
          onChangeText={setActions}
          placeholder="e.g. First aid given, equipment switched off, customer refunded"
          multiline
          textAlignVertical="top"
          style={styles.multilineShort}
          testID="inc-actions"
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Follow-up needed</Text>
            <Text style={styles.hint}>Turn on if someone needs to act on this after review.</Text>
          </View>
          <Switch
            value={followUp}
            onValueChange={setFollowUp}
            trackColor={{ true: colors.brand, false: colors.borderStrong }}
            thumbColor={colors.surface}
            testID="inc-followup"
          />
        </View>

        <Text style={styles.by}>
          Reported by <Text style={styles.byName}>{user?.name}</Text>
        </Text>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button title="Submit report" onPress={onSubmit} loading={submit.isPending} testID="submit-incident-button" />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.xl },
  block: { gap: spacing.sm },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  optional: { fontFamily: fonts.regular, color: colors.muted },
  subLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  single: { fontFamily: fonts.semibold, fontSize: 18, color: colors.onSurface },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pick: { paddingVertical: 10, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.brand },
  pickOn: { backgroundColor: colors.brand },
  pickText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  pickTextOn: { color: colors.onBrand },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },

  urgencyRow: { flexDirection: "row", gap: spacing.sm },
  urgency: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 2, alignItems: "center" },
  urgencyText: { fontFamily: fonts.semibold, fontSize: 13 },

  people: { gap: spacing.sm },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  personOn: { borderColor: colors.brand },
  personName: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface },
  personRole: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  box: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },

  twoCol: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1, gap: spacing.xs },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.onSurface,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
  },
  multiline: { minHeight: 120, paddingTop: 11 },
  multilineShort: { minHeight: 80, paddingTop: 11 },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },

  by: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  byName: { fontFamily: fonts.medium, color: colors.onSurface },

  footer: { backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
}));
