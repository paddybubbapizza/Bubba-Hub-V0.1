import { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";

import { useAuth } from "@/src/auth/auth-context";
import { Button, Card, Field } from "@/src/components/ui";
import { makeStyles, fonts, spacing, radius } from "@/src/theme";
import { ApiError } from "@/src/api/client";

export default function SignIn() {
  const { user, signIn } = useAuth();
  const router = useRouter();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Redirect href="/(tabs)" />;

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(username.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1651981038189-e71e557f5869?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
            }}
            style={styles.heroImage}
            contentFit="cover"
          />
          <View style={styles.heroScrim} />
          <View style={styles.heroContent}>
            <Text style={styles.logo}>
              <Text style={styles.logoBubba}>Bubba </Text>
              <Text style={styles.logoHub}>Hub</Text>
            </Text>
            <Text style={styles.heroTag}>Store operations, all in one place</Text>
          </View>
        </View>

        <View style={styles.formWrap}>
          <Text style={styles.title}>Sign in to Bubba Hub</Text>

          <View style={styles.form}>
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder="e.g. paddyshepherd"
              testID="login-username-input"
              returnKeyType="next"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Your password"
              testID="login-password-input"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
            {error ? (
              <Text style={styles.error} testID="login-error">
                {error}
              </Text>
            ) : null}
            <Button title="Sign in" onPress={onSubmit} loading={loading} testID="login-submit-button" />
          </View>

          <Card style={styles.hint}>
            <Text style={styles.hintTitle}>Demo logins</Text>
            <Text style={styles.hintRow}>Company: paddyshepherd</Text>
            <Text style={styles.hintRow}>Franchisee: harrypatel</Text>
            <Text style={styles.hintRow}>Password for all: password</Text>
          </Card>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1 },
  hero: { height: 240, justifyContent: "flex-end" },
  heroImage: { ...StyleSheetAbsolute(), width: "100%", height: "100%" },
  heroScrim: { ...StyleSheetAbsolute(), backgroundColor: "rgba(17,17,17,0.45)" },
  heroContent: { padding: spacing.xl, paddingBottom: spacing.xl },
  logo: { fontSize: 40 },
  logoBubba: { fontFamily: fonts.extrabold, color: "#ffffff" },
  logoHub: { fontFamily: fonts.extrabold, color: colors.brand },
  heroTag: { fontFamily: fonts.medium, fontSize: 15, color: "#f5f5f5", marginTop: spacing.xs },
  formWrap: { padding: spacing.xl, gap: spacing.xl },
  title: { fontFamily: fonts.semibold, fontSize: 24, color: colors.onSurface },
  form: { gap: spacing.lg },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.error },
  hint: { gap: spacing.xs, backgroundColor: colors.surfaceTertiary, borderColor: colors.border },
  hintTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  hintRow: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
}));

function StyleSheetAbsolute() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.sm };
}
