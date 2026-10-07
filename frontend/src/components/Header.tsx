import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, spacing } from "@/src/theme";

type Props = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  logo?: boolean;
};

export function Header({ title, subtitle, showBack, onBack, right, logo }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {showBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={10}
              style={styles.back}
              testID="header-back-button"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={24} color={colors.brand} />
            </Pressable>
          ) : null}
          <View style={styles.titleWrap}>
            {logo ? (
              <Text style={styles.logo} testID="header-logo">
                <Text style={styles.logoBubba}>Bubba </Text>
                <Text style={styles.logoHub}>Hub</Text>
              </Text>
            ) : (
              <Text style={styles.title} numberOfLines={1} testID="header-title">
                {title}
              </Text>
            )}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 3,
    borderBottomColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    gap: spacing.md,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, gap: spacing.xs },
  back: { marginLeft: -6, marginRight: spacing.xs },
  titleWrap: { flex: 1 },
  title: { fontFamily: fonts.semibold, fontSize: 22, color: colors.onSurfaceSecondary },
  logo: { fontSize: 24 },
  logoBubba: { fontFamily: fonts.extrabold, color: colors.brand },
  logoHub: { fontFamily: fonts.extrabold, color: colors.onSurfaceSecondary },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
}));
