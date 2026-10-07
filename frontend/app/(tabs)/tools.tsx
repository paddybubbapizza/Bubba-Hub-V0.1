import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Header } from "@/src/components/Header";
import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";

const TOOLS = [
  { key: "checks", title: "Store Checks", sub: "Daily open and close checklists", icon: "clipboard", to: "/checks" as const },
  { key: "incidents", title: "Incident Reports", sub: "Log an accident, injury or issue", icon: "warning", to: "/incidents" as const },
  { key: "training", title: "Training", sub: "Courses and how-to guides", icon: "school", to: "/training" as const },
];

export default function Tools() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Header title="Tools" subtitle="Everything you need on shift" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {TOOLS.map((a) => (
          <Pressable
            key={a.key}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            onPress={() => router.push(a.to)}
            testID={`tools-${a.key}`}
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
