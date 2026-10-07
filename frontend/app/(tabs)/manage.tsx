import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useAuth } from "@/src/auth/auth-context";
import { Header } from "@/src/components/Header";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";

export default function Manage() {
  const { user } = useAuth();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();

  const items = [
    {
      key: "accounts",
      title: "Account Management",
      sub: "Add, edit and turn off staff accounts",
      icon: "people",
      to: "/manage/accounts" as const,
      show: true,
    },
    {
      key: "templates",
      title: "Store Check Management",
      sub: "Edit check items and store layouts",
      icon: "construct",
      to: "/manage/templates" as const,
      show: user?.co,
    },
  ].filter((i) => i.show);

  return (
    <View style={styles.container}>
      <Header title="Manage" subtitle={user?.role} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {items.map((a) => (
          <Pressable
            key={a.key}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            onPress={() => router.push(a.to)}
            testID={`manage-${a.key}`}
          >
            <View style={styles.actionIcon}>
              <Ionicons name={a.icon as any} size={26} color={colors.onBrand} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>{a.title}</Text>
              <Text style={styles.actionSub}>{a.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.md },
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
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1 },
  actionTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface },
  actionSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
}));
