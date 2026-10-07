import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { Button, Segmented } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Check, Template, TempRow } from "@/src/types";

export default function NewCheck() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const stores = user?.stores ?? [];
  const singleStore = stores.length === 1 ? stores[0] : "";

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api<Template[]>("/templates"),
  });

  const [store, setStore] = useState<string>(singleStore);
  const [typeName, setTypeName] = useState<string>("");
  const [shift, setShift] = useState<"Open" | "Close">("Open");
  const [checkState, setCheckState] = useState<Record<number, boolean>>({});
  const [tempState, setTempState] = useState<Record<number, string>>({});
  const [touched, setTouched] = useState(false);

  // Default the type once templates load
  const template = useMemo(
    () => templates.find((t) => t.name === typeName) ?? templates[0],
    [templates, typeName],
  );
  const effectiveType = template?.name ?? "";

  const rows = useMemo(() => {
    if (!template) return [];
    return template.overrides?.[store] ?? template.rows;
  }, [template, store]);

  const resetValues = () => {
    setCheckState({});
    setTempState({});
    setTouched(false);
  };

  const submit = useMutation({
    mutationFn: (body: any) => api<Check>("/checks", { method: "POST", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      toast("Store check submitted for review", "success");
      router.back();
    },
    onError: (e: any) => toast(e?.message ?? "Could not submit the check", "error"),
  });

  const tempInvalid = (i: number) => {
    if (!template || template.k !== "t") return false;
    const v = tempState[i];
    return v === undefined || v.trim() === "" || isNaN(parseFloat(v));
  };

  const canSubmit = () => {
    if (!template) return false;
    if (!store) return false;
    if (template.k === "t") return rows.every((_, i) => !tempInvalid(i));
    return true; // checklist can be submitted with any number ticked
  };

  const onSubmit = () => {
    setTouched(true);
    if (!store) {
      toast("Choose a store first", "error");
      return;
    }
    if (!canSubmit()) {
      toast("Enter all temperature readings", "error");
      return;
    }
    const values =
      template!.k === "l"
        ? rows.map((_, i) => !!checkState[i])
        : rows.map((_, i) => parseFloat(tempState[i]));
    submit.mutate({
      store,
      type: effectiveType,
      shift: template!.shift ? shift : "",
      values,
    });
  };

  const hint = (r: TempRow) => (r.limitType === "max" ? `${r.limit}°C or colder` : `${r.limit}°C or hotter`);

  return (
    <View style={styles.container}>
      <Header title="New Store Check" showBack onBack={() => router.back()} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing["3xl"] }]}
        bottomOffset={90}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {stores.length > 1 ? (
          <View style={styles.block}>
            <Text style={styles.label}>Store</Text>
            <View style={styles.wrapRow}>
              {stores.map((s) => {
                const on = store === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setStore(s)}
                    style={[styles.pick, on && styles.pickOn]}
                    testID={`new-store-${s}`}
                  >
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

        <View style={styles.block}>
          <Text style={styles.label}>Check</Text>
          <View style={styles.wrapRow}>
            {templates.map((t) => {
              const on = effectiveType === t.name;
              return (
                <Pressable
                  key={t.name}
                  onPress={() => {
                    setTypeName(t.name);
                    resetValues();
                  }}
                  style={[styles.pick, on && styles.pickOn]}
                  testID={`new-type-${t.name}`}
                >
                  <Text style={[styles.pickText, on && styles.pickTextOn]}>{t.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {template?.shift ? (
          <View style={styles.block}>
            <Text style={styles.label}>Shift</Text>
            <Segmented
              options={[
                { label: "Open", value: "Open" },
                { label: "Close", value: "Close" },
              ]}
              value={shift}
              onChange={setShift}
              testID="shift-toggle"
            />
          </View>
        ) : null}

        <Text style={styles.by}>
          Completed by <Text style={styles.byName}>{user?.name}</Text>
        </Text>

        <View style={styles.items}>
          {template?.k === "l"
            ? rows.map((r, i) => {
                const checked = !!checkState[i];
                return (
                  <Pressable
                    key={i}
                    onPress={() => setCheckState((s) => ({ ...s, [i]: !checked }))}
                    style={styles.checkItem}
                    testID={`check-item-${i}`}
                  >
                    <View style={[styles.box, checked && styles.boxOn]}>
                      {checked ? <Ionicons name="checkmark" size={16} color={colors.onBrand} /> : null}
                    </View>
                    <Text style={styles.checkLabel}>{r.name}</Text>
                  </Pressable>
                );
              })
            : rows.map((r, i) => {
                const row = r as TempRow;
                const invalid = touched && tempInvalid(i);
                return (
                  <View key={i} style={styles.tempItem}>
                    <View style={styles.tempLeft}>
                      <Text style={styles.tempName}>{row.name}</Text>
                      <Text style={styles.tempHint}>{hint(row)}</Text>
                    </View>
                    <View style={styles.tempInputWrap}>
                      <TempInput
                        value={tempState[i] ?? ""}
                        onChange={(v) => setTempState((s) => ({ ...s, [i]: v }))}
                        invalid={invalid}
                        testID={`temp-input-${i}`}
                      />
                      <Text style={styles.unit}>°C</Text>
                    </View>
                  </View>
                );
              })}
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            title="Submit for review"
            onPress={onSubmit}
            loading={submit.isPending}
            testID="submit-check-button"
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function TempInput({
  value,
  onChange,
  invalid,
  testID,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.tempInputBox, invalid && styles.tempInputInvalid]}>
      <TextInput
        style={styles.tempInput}
        value={value}
        onChangeText={onChange}
        keyboardType="numbers-and-punctuation"
        inputMode="decimal"
        placeholder="0.0"
        placeholderTextColor={colors.muted}
        testID={testID}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.xl },
  block: { gap: spacing.sm },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  single: { fontFamily: fonts.semibold, fontSize: 18, color: colors.onSurface },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pick: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  pickOn: { backgroundColor: colors.brand },
  pickText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  pickTextOn: { color: colors.onBrand },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },

  by: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  byName: { fontFamily: fonts.medium, color: colors.onSurface },

  items: { gap: spacing.sm },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.onSurface, flex: 1 },

  tempItem: {
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
  tempLeft: { flex: 1 },
  tempName: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface },
  tempHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  tempInputWrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  tempInputBox: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    width: 86,
  },
  tempInputInvalid: { borderColor: colors.error },
  tempInput: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onSurface,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    textAlign: "center",
  },
  unit: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },

  footer: {
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
}));
