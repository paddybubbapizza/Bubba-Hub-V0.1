import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { Button, Field, Pill } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Role, Store, User } from "@/src/types";

const ALL_ROLES: Role[] = ["Staff", "Manager", "Franchisee", "Company account"];

export default function Accounts() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const sheetRef = useRef<BottomSheetModal>(null);

  const rolesAvailable: Role[] = user?.co ? ALL_ROLES : ["Staff", "Manager"];
  const myStores = user?.stores ?? [];

  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => api<User[]>("/accounts") });
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: () => api<Store[]>("/stores") });
  const allStoreNames = stores.map((s) => s.name);

  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<string | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>(rolesAvailable[0]);
  const [picked, setPicked] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const storeOptions = useMemo(() => {
    if (role === "Franchisee") return allStoreNames;
    return myStores;
  }, [role, allStoreNames, myStores]);

  const { data: preview } = useQuery({
    queryKey: ["username-preview", first.trim(), last.trim()],
    queryFn: () => api<{ username: string }>(`/accounts/username-preview?first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}`),
    enabled: mode === "add" && !!first.trim() && !!last.trim(),
  });

  const openAdd = useCallback(() => {
    setMode("add");
    setEditId(null);
    setFirst("");
    setLast("");
    setUsername("");
    setRole(rolesAvailable[0]);
    setPicked([]);
    setPassword("");
    setActive(true);
    sheetRef.current?.present();
  }, [rolesAvailable]);

  const openEdit = useCallback((a: User) => {
    setMode("edit");
    setEditId(a.id);
    setFirst(a.first);
    setLast(a.name.slice(a.first.length).trim());
    setUsername(a.username);
    setRole(a.role);
    setPicked(a.stores);
    setPassword("");
    setActive(a.active);
    sheetRef.current?.present();
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      if (mode === "add") {
        return api<{ message: string }>("/accounts", {
          method: "POST",
          body: { first, last, role, stores: picked, password: password || null },
        });
      }
      return api<User>(`/accounts/${editId}`, {
        method: "PATCH",
        body: { first, last, username, role, stores: picked, password: password || null, active },
      });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      sheetRef.current?.dismiss();
      toast(res?.message ?? "Changes saved", "success");
    },
    onError: (e: any) => toast(e?.message ?? "Could not save account", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setPendingRemove(null);
      toast("Account removed", "success");
    },
    onError: (e: any) => toast(e?.message ?? "Could not remove account", "error"),
  });

  const toggleStore = (name: string, single: boolean) => {
    if (single) {
      setPicked([name]);
    } else {
      setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
    }
  };

  const showStorePicker = role === "Franchisee" || role === "Manager" || role === "Staff";
  const singleStore = role === "Staff";

  return (
    <View style={styles.container}>
      <Header title="Account Management" showBack onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Button title="Add an account" icon="person-add" onPress={openAdd} testID="add-account-button" />

        <Text style={styles.heading}>Accounts</Text>
        {accounts.map((a) => {
          const isSelf = a.id === user?.id;
          return (
            <View key={a.id} style={styles.row} testID={`account-row-${a.username}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{a.name}</Text>
                <Text style={styles.meta}>
                  {a.co ? "All stores" : a.stores.join(" · ")} · {a.role}
                </Text>
                <Text style={styles.metaFaint}>Username {a.username}</Text>
                {!a.active ? (
                  <View style={styles.rowPill}>
                    <Pill label="Turned off" tone="error" />
                  </View>
                ) : null}
              </View>
              {isSelf ? (
                <View style={styles.youBadge}>
                  <Text style={styles.youText}>You</Text>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Button title="Edit" small variant="outline" onPress={() => openEdit(a)} testID={`edit-${a.username}`} />
                  <Button
                    title={pendingRemove === a.id ? "Confirm" : "Remove"}
                    small
                    variant="outline"
                    onPress={() => (pendingRemove === a.id ? remove.mutate(a.id) : setPendingRemove(a.id))}
                    testID={`remove-${a.username}`}
                  />
                </View>
              )}
            </View>
          );
        })}
        <Text style={styles.footNote}>New accounts use the placeholder password &quot;password&quot;.</Text>
      </KeyboardAwareScrollView>

      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backdropComponent={(p) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />}
      >
        <KeyboardAwareScrollView
          ScrollViewComponent={BottomSheetScrollView}
          contentContainerStyle={styles.sheet}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sheetTitle}>{mode === "add" ? "Add an account" : `Edit ${first}`}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Account type</Text>
            <View style={styles.wrapRow}>
              {rolesAvailable.map((r) => {
                const on = role === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => {
                      setRole(r);
                      setPicked([]);
                    }}
                    style={[styles.pick, on && styles.pickOn]}
                    testID={`role-${r}`}
                  >
                    <Text style={[styles.pickText, on && styles.pickTextOn]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field label="First name" value={first} onChangeText={setFirst} testID="sheet-first" />
          <Field label="Last name" value={last} onChangeText={setLast} testID="sheet-last" />
          {mode === "edit" ? (
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              testID="sheet-username"
            />
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.usernameBox}>
                <Ionicons name="at" size={16} color={colors.muted} />
                <Text style={[styles.usernameText, !preview?.username && styles.usernamePlaceholder]} testID="sheet-username-preview">
                  {preview?.username || "Generated from the first and last name"}
                </Text>
              </View>
            </View>
          )}

          {role === "Company account" ? (
            <Text style={styles.note}>Company accounts can access all stores.</Text>
          ) : showStorePicker ? (
            <View style={styles.field}>
              <Text style={styles.label}>{singleStore ? "Store" : "Stores (choose one or more)"}</Text>
              <View style={styles.wrapRow}>
                {storeOptions.map((s) => {
                  const on = picked.includes(s);
                  return (
                    <Pressable
                      key={s}
                      onPress={() => toggleStore(s, singleStore)}
                      style={[styles.pick, on && styles.pickOn]}
                      testID={`sheet-store-${s}`}
                    >
                      <Text style={[styles.pickText, on && styles.pickTextOn]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Field
            label={mode === "add" ? "Password (optional)" : "New password"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Leave blank to keep the placeholder"
            testID="sheet-password"
          />

          {mode === "edit" ? (
            <Pressable style={styles.activeRow} onPress={() => setActive((v) => !v)} testID="sheet-active">
              <View style={[styles.box, active && styles.boxOn]}>
                {active ? <Ionicons name="checkmark" size={16} color={colors.onBrand} /> : null}
              </View>
              <Text style={styles.checkLabel}>Account is active</Text>
            </Pressable>
          ) : null}

          <Button
            title={mode === "add" ? "Add account" : "Save changes"}
            onPress={() => save.mutate()}
            loading={save.isPending}
            testID="sheet-save"
          />
        </KeyboardAwareScrollView>
      </BottomSheetModal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["2xl"] },
  heading: { fontFamily: fonts.semibold, fontSize: 17, color: colors.onSurface, marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  name: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  metaFaint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  rowPill: { marginTop: spacing.xs },
  actions: { gap: spacing.sm },
  youBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.md,
  },
  youText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  footNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: spacing.sm },

  sheet: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["2xl"] },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 20, color: colors.onSurface },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  note: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  usernameBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
  },
  usernameText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  usernamePlaceholder: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pick: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  pickOn: { backgroundColor: colors.brand },
  pickText: { fontFamily: fonts.medium, fontSize: 13, color: colors.brand },
  pickTextOn: { color: colors.onBrand },
  activeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
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
  checkLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.onSurface },
}));
