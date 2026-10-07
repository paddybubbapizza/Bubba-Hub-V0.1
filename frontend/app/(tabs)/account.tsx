import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { Button, Card, Field } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, fonts, spacing, radius } from "@/src/theme";import type { User } from "@/src/types";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];

export default function Account() {
  const { user, setUser, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();

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

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      const updated = await api<User>("/auth/me", {
        method: "PATCH",
        body: { pref, dob, gender, phone, email },
      });
      setUser(updated);
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
      setCurrent("");
      setNext("");
      setConfirm("");
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

  return (
    <View style={styles.container}>
      <Header title="Account" subtitle={`${user?.name} · ${user?.role}`} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.first || "?").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileMeta}>Username {user?.username}</Text>
          </View>
        </View>

        <Text style={styles.heading}>Your details</Text>
        <Card style={styles.card}>
          <Field label="Preferred name" value={pref} onChangeText={setPref} placeholder="What should we call you?" testID="pref-input" />
          <Field label="Date of birth" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" testID="dob-input" />
          <View style={styles.field}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((g) => {
                const on = gender === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGender(on ? "" : g)}
                    style={[styles.genderChip, on && styles.genderChipOn]}
                    testID={`gender-${g}`}
                  >
                    <Text style={[styles.genderText, on && styles.genderTextOn]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Field label="Mobile" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone number" testID="phone-input" />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Email address" testID="email-input" />
          <Button title="Save details" onPress={saveDetails} loading={savingDetails} testID="save-details-button" />
        </Card>

        <Text style={styles.heading}>Change password</Text>
        <Card style={styles.card}>
          <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry testID="current-password-input" />
          <Field label="New password" value={next} onChangeText={setNext} secureTextEntry testID="new-password-input" />
          <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry testID="confirm-password-input" />
          {pwError ? <Text style={styles.error}>{pwError}</Text> : null}
          <Button title="Change password" onPress={changePassword} loading={savingPw} testID="change-password-button" />
        </Card>

        <Button title="Sign out" variant="outline" icon="log-out-outline" onPress={onSignOut} testID="sign-out-button" />
        <Text style={styles.footNote}>Your personal details are only shown to you.</Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing["2xl"], gap: spacing.lg },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.onBrand },
  profileName: { fontFamily: fonts.semibold, fontSize: 18, color: colors.onSurface },
  profileMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },

  heading: { fontFamily: fonts.semibold, fontSize: 17, color: colors.onSurface },
  card: { gap: spacing.lg },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  genderChip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  genderChipOn: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  genderText: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurface },
  genderTextOn: { color: colors.onBrandTertiary, fontFamily: fonts.medium },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.error },
  footNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
}));
