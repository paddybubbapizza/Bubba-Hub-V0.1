import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { Header } from "@/src/components/Header";
import { Button, Card, Segmented } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Row, Store, TempRow, Template } from "@/src/types";

export default function Templates() {
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => api<Template[]>("/templates") });
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: () => api<Store[]>("/stores") });

  const [typeName, setTypeName] = useState("");
  const [layout, setLayout] = useState("default");
  const [rows, setRows] = useState<Row[]>([]);
  const [isNone, setIsNone] = useState(false);

  const template = useMemo(() => templates.find((t) => t.name === typeName) ?? templates[0], [templates, typeName]);
  const effectiveType = template?.name ?? "";

  useEffect(() => {
    if (!template) return;
    if (layout === "default") {
      setRows(JSON.parse(JSON.stringify(template.rows)));
      setIsNone(false);
    } else {
      const ov = template.overrides?.[layout];
      if (ov) {
        setRows(JSON.parse(JSON.stringify(ov)));
        setIsNone(false);
      } else {
        setRows([]);
        setIsNone(true);
      }
    }
  }, [template, layout]);

  const saveLayout = useMutation({
    mutationFn: () => api(`/templates/${encodeURIComponent(effectiveType)}/layout`, { method: "PUT", body: { layout, rows } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast("Layout saved", "success");
    },
    onError: (e: any) => toast(e?.message ?? "Could not save", "error"),
  });

  const resetLayout = useMutation({
    mutationFn: () => api(`/templates/${encodeURIComponent(effectiveType)}/layout/${encodeURIComponent(layout)}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast("Reset to the default layout", "success");
    },
    onError: (e: any) => toast(e?.message ?? "Could not reset", "error"),
  });

  const updateRow = (i: number, patch: Partial<TempRow> & { name?: string }) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => {
    if (!template) return;
    setRows((rs) => [...rs, template.k === "t" ? { name: "New reading", limitType: "max", limit: 5 } : { name: "New item" }]);
  };
  const removeRow = (i: number) => {
    setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));
  };
  const createCustom = () => {
    if (!template) return;
    setRows(JSON.parse(JSON.stringify(template.rows)));
    setIsNone(false);
  };

  // Add-new-check form
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"t" | "l">("t");
  const [newShift, setNewShift] = useState(false);
  const createTemplate = useMutation({
    mutationFn: () => api<Template>("/templates", { method: "POST", body: { name: newName, k: newKind, shift: newShift } }),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setNewName("");
      setNewShift(false);
      setTypeName(t.name);
      setLayout("default");
      toast(`${t.name} added. Edit its items above.`, "success");
    },
    onError: (e: any) => toast(e?.message ?? "Could not add check", "error"),
  });

  const layoutOptions = ["default", ...stores.map((s) => s.name)];

  return (
    <View style={styles.container}>
      <Header title="Store Check Management" showBack onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} bottomOffset={24}>
        <View style={styles.block}>
          <Text style={styles.label}>Check</Text>
          <View style={styles.wrapRow}>
            {templates.map((t) => {
              const on = effectiveType === t.name;
              return (
                <Pressable key={t.name} onPress={() => { setTypeName(t.name); setLayout("default"); }} style={[styles.pick, on && styles.pickOn]} testID={`tmpl-${t.name}`}>
                  <Text style={[styles.pickText, on && styles.pickTextOn]}>{t.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Layout for</Text>
          <View style={styles.wrapRow}>
            {layoutOptions.map((l) => {
              const on = layout === l;
              const custom = l !== "default" && !!template?.overrides?.[l];
              return (
                <Pressable key={l} onPress={() => setLayout(l)} style={[styles.pickAlt, on && styles.pickAltOn]} testID={`layout-${l}`}>
                  <Text style={[styles.pickAltText, on && styles.pickAltTextOn]}>
                    {l === "default" ? "All stores (default)" : l}
                    {custom ? " •" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {isNone ? (
          <Card style={styles.card}>
            <Text style={styles.note}>{layout} uses the default layout.</Text>
            <Button title={`Create a custom layout for ${layout}`} variant="outline" onPress={createCustom} testID="create-custom-layout" />
          </Card>
        ) : (
          <View style={styles.editor}>
            {rows.map((r, i) => (
              <Card key={i} style={styles.rowCard}>
                <TextInput
                  style={styles.rowInput}
                  value={r.name}
                  onChangeText={(v) => updateRow(i, { name: v })}
                  placeholder="Name"
                  placeholderTextColor={colors.muted}
                  testID={`row-name-${i}`}
                />
                {template?.k === "t" ? (
                  <View style={styles.tempControls}>
                    <Segmented
                      options={[
                        { label: "or colder", value: "max" },
                        { label: "or hotter", value: "min" },
                      ]}
                      value={(r as TempRow).limitType}
                      onChange={(v) => updateRow(i, { limitType: v as "max" | "min" })}
                      testID={`row-limit-${i}`}
                    />
                    <View style={styles.limitWrap}>
                      <TextInput
                        style={styles.limitInput}
                        value={String((r as TempRow).limit)}
                        onChangeText={(v) => updateRow(i, { limit: parseFloat(v) || 0 })}
                        keyboardType="numbers-and-punctuation"
                        inputMode="decimal"
                        testID={`row-value-${i}`}
                      />
                      <Text style={styles.unit}>°C</Text>
                    </View>
                  </View>
                ) : null}
                <Pressable onPress={() => removeRow(i)} style={styles.removeRow} testID={`row-remove-${i}`}>
                  <Ionicons name="trash-outline" size={16} color={colors.brand} />
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </Card>
            ))}
            <View style={styles.editorActions}>
              <Button title={template?.k === "t" ? "Add reading" : "Add item"} variant="outline" small onPress={addRow} testID="add-row" />
              <Button title="Save changes" small onPress={() => saveLayout.mutate()} loading={saveLayout.isPending} testID="save-layout" />
              {layout !== "default" ? (
                <Button title="Reset to default" variant="outline" small onPress={() => resetLayout.mutate()} loading={resetLayout.isPending} testID="reset-layout" />
              ) : null}
            </View>
          </View>
        )}

        <Text style={styles.heading}>Add a new check</Text>
        <Card style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.rowInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Freezer Check"
              placeholderTextColor={colors.muted}
              testID="new-tmpl-name"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <Segmented
              options={[
                { label: "Temperature", value: "t" },
                { label: "Checklist", value: "l" },
              ]}
              value={newKind}
              onChange={(v) => setNewKind(v as "t" | "l")}
              testID="new-tmpl-kind"
            />
          </View>
          <Pressable style={styles.activeRow} onPress={() => setNewShift((v) => !v)} testID="new-tmpl-shift">
            <View style={[styles.box, newShift && styles.boxOn]}>
              {newShift ? <Ionicons name="checkmark" size={16} color={colors.onBrand} /> : null}
            </View>
            <Text style={styles.checkLabel}>Open / Close toggle</Text>
          </Pressable>
          <Button title="Add check" onPress={() => createTemplate.mutate()} loading={createTemplate.isPending} testID="add-tmpl" />
        </Card>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["2xl"] },
  block: { gap: spacing.sm },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pick: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.brand },
  pickOn: { backgroundColor: colors.brand },
  pickText: { fontFamily: fonts.medium, fontSize: 13, color: colors.brand },
  pickTextOn: { color: colors.onBrand },
  pickAlt: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  pickAltOn: { borderColor: colors.onSurface, backgroundColor: colors.surfaceInverse },
  pickAltText: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSurface },
  pickAltTextOn: { color: colors.onSurfaceInverse },

  card: { gap: spacing.md },
  note: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },

  editor: { gap: spacing.md },
  rowCard: { gap: spacing.md },
  rowInput: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.onSurface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  tempControls: { gap: spacing.sm },
  limitWrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  limitInput: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onSurface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    width: 90,
    textAlign: "center",
    backgroundColor: colors.surface,
  },
  unit: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  removeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start" },
  removeText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  editorActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  heading: { fontFamily: fonts.semibold, fontSize: 17, color: colors.onSurface, marginTop: spacing.sm },
  field: { gap: spacing.xs },
  activeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  box: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.onSurface },
}));
