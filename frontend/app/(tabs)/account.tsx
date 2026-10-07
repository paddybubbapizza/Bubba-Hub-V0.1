import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { Button, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { User } from "@/src/types";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];

export default function Account() {
  const { user, setUser, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();

  const detailsSheet = useRef<BottomSheetModal>(null);
  const passwordSheet = useRef<BottomSheetModal>(null);

  const [pref, setPref] = useState(user?.pref ?? "");
  const [dob, setDob] = useState(user?.dob ?? "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingDetails, setSavingDetails] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const openDetails = () => {
    setPref(user?.pref ?? "");
    setDob(user?.dob ?? "");
    setGender(user?.gender ?? "");
    setPhone(user?.phone ?? "");
    setEmail(user?.email ?? "");
    detailsSheet.current?.present();
  };

  const openPassword = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setPwError("");
    passwordSheet.current?.present();
  };

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      const updated = await api<User>("/auth/me", { method: "PATCH", body: { pref, dob, gender, phone, email } });
      setUser(updated);
      detailsSheet.current?.dismiss();
      toast("Details saved", "success");
    } catch (e: any) {
      toast(e?.message ?? "Could not save details", "error");
    } finally {
      setSavingDetails(false);
    }
  };

  const changePassword = async () => {
    setPwError("");
    if (!current || !next || !confirm) {
      setPwError("Fill in all password fields.");
      return;
    }
    if (next !== confirm) {
      setPwError("The new passwords don't match.");
      return;
    }
    setSavingPw(true);
    try {
      await api("/auth/change-password", { method: "POST", body: { current, new: next } });
      passwordSheet.current?.dismiss();
      toast("Password changed", "success");
    } catch (e: any) {
      setPwError(e?.message ?? "Could not change password");
    } finally {
      setSavingPw(false);
    }
  };

  const onSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  const ActionRow = ({ icon, title, sub, onPress, testID }: { icon: string; title: string; sub: string; onPress: () => void; testID: string }) => (
    <Pressable style={({ pressed }) => [styles.action, pressed && styles.actionPressed]} onPress={onPress} testID={testID}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon as any} size={22} color={colors.brand} />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Header title="Account" subtitle={user?.role} />
      <View style={styles.body}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.first || "?").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileMeta}>Username {user?.username}</Text>
            <Text style={styles.profileMeta}>{user?.role}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <ActionRow icon="person-outline" title="Edit account details" sub="Preferred name, contact and more" onPress={openDetails} testID="open-details-button" />
          <ActionRow icon="lock-closed-outline" title="Change password" sub="Update your sign-in password" onPress={openPassword} testID="open-password-button" />
        </View>

        <View style={styles.spacer} />
        <Button title="Sign out" variant="outline" icon="log-out-outline" onPress={onSignOut} testID="sign-out-button" />
        <Text style={styles.footNote}>Your personal details are only shown to you.</Text>
      </View>

      {/* Edit details sheet */}
      <BottomSheetModal
        ref={detailsSheet}
        enableDynamicSizing
        backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backdropComponent={(p) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />}
      >
        <KeyboardAwareScrollView ScrollViewComponent={BottomSheetScrollView} contentContainerStyle={styles.sheet} bottomOffset={24} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>Edit account details</Text>
          <Field label="Preferred name" value={pref} onChangeText={setPref} placeholder="What should we call you?" testID="pref-input" />
          <Field label="Date of birth" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" testID="dob-input" />
          <View style={styles.field}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((g) => {
                const on = gender === g;
                return (
                  <Pressable key={g} onPress={() => setGender(on ? "" : g)} style={[styles.genderChip, on && styles.genderChipOn]} testID={`gender-${g}`}>
                    <Text style={[styles.genderText, on && styles.genderTextOn]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Field label="Mobile" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone number" testID="phone-input" />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Email address" testID="email-input" />
          <Button title="Save details" onPress={saveDetails} loading={savingDetails} testID="save-details-button" />
        </KeyboardAwareScrollView>
      </BottomSheetModal>

      {/* Change password sheet */}
      <BottomSheetModal
        ref={passwordSheet}
        enableDynamicSizing
        backgroundStyle={{ backgroundColor: colors.surfaceSecondary }}
        handleIndicatorStyle={{ backgroundColor: colors.borderStrong }}
        backdropComponent={(p) => <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />}
      >
        <KeyboardAwareScrollView ScrollViewComponent={BottomSheetScrollView} contentContainerStyle={styles.sheet} bottomOffset={24} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>Change password</Text>
          <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry testID="current-password-input" />
          <Field label="New password" value={next} onChangeText={setNext} secureTextEntry testID="new-password-input" />
          <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry testID="confirm-password-input" />
          {pwError ? <Text style={styles.error}>{pwError}</Text> : null}
          <Button title="Change password" onPress={changePassword} loading={savingPw} testID="change-password-button" />
        </KeyboardAwareScrollView>
      </BottomSheetModal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.onBrand },
  profileName: { fontFamily: fonts.semibold, fontSize: 18, color: colors.onSurface },
  profileMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },

  actions: { gap: spacing.md },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  actionPressed: { borderColor: colors.brand, opacity: 0.95 },
  actionIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1 },
  actionTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  actionSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },

  spacer: { flex: 1 },
  footNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center" },

  sheet: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing["2xl"] },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 20, color: colors.onSurface },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  genderChip: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  genderChipOn: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  genderText: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurface },
  genderTextOn: { color: colors.onBrandTertiary, fontFamily: fonts.medium },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.error },
}));
