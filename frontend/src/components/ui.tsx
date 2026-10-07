import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { CheckStatus } from "@/src/types";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  testID?: string;
  style?: ViewStyle;
  small?: boolean;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  testID,
  style,
  small,
}: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isPrimary = variant === "primary";
  const isOutline = variant === "outline";
  const fg = isPrimary ? colors.onBrandPrimary : colors.brand;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        isPrimary && styles.btnPrimary,
        isOutline && styles.btnOutline,
        variant === "ghost" && styles.btnGhost,
        (disabled || loading) && styles.btnDisabled,
        pressed && styles.btnPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <Ionicons name={icon as any} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.btnText, small && styles.btnTextSmall, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  children,
  style,
  accent,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: boolean;
}) {
  const styles = useStyles();
  return <View style={[styles.card, accent && styles.cardAccent, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Field (label above input)
// ---------------------------------------------------------------------------
type FieldProps = TextInputProps & { label: string; error?: string };

export function Field({ label, error, style, ...rest }: FieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !!error && styles.inputError]}
        placeholderTextColor={colors.muted}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.seg} testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && styles.segItemOn]}
            testID={`${testID}-${o.value}`}
          >
            <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
export function StatusBadge({ status, rev }: { status: CheckStatus; rev?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const config =
    status === "approved"
      ? { label: rev ? `Approved · ${rev}` : "Approved", color: colors.success }
      : status === "returned"
        ? { label: rev ? `Returned · ${rev}` : "Returned", color: colors.error }
        : { label: "Awaiting review", color: colors.muted };
  return (
    <View style={[styles.badge, { borderColor: config.color }]}>
      <Text style={[styles.badgeText, { color: config.color }]} numberOfLines={1}>
        {config.label}
      </Text>
    </View>
  );
}

export function Pill({ label, tone = "muted" }: { label: string; tone?: "muted" | "error" | "warning" }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = tone === "error" ? colors.error : tone === "warning" ? colors.warning : colors.muted;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function EmptyState({
  icon = "clipboard-outline",
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as any} size={34} color={colors.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnSmall: { paddingVertical: 9, paddingHorizontal: spacing.md, minHeight: 38, borderRadius: radius.sm },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnOutline: { borderWidth: 2, borderColor: colors.brand, backgroundColor: "transparent" },
  btnGhost: { backgroundColor: "transparent" },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  btnText: { fontFamily: fonts.medium, fontSize: 16 },
  btnTextSmall: { fontSize: 14 },

  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardAccent: { borderLeftWidth: 5, borderLeftColor: colors.brand },

  field: { gap: spacing.xs },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
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
  inputError: { borderColor: colors.error },
  errorText: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },

  seg: {
    flexDirection: "row",
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.md,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  segItem: { paddingVertical: 10, paddingHorizontal: spacing.xl, backgroundColor: "transparent" },
  segItemOn: { backgroundColor: colors.brand },
  segText: { fontFamily: fonts.medium, fontSize: 14, color: colors.brand },
  segTextOn: { color: colors.onBrand },

  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
  },
  badgeText: { fontFamily: fonts.medium, fontSize: 12 },

  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  pillText: { fontFamily: fonts.medium, fontSize: 12 },

  empty: { alignItems: "center", paddingVertical: spacing["3xl"], gap: spacing.md },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.onSurface, textAlign: "center" },
  emptyMessage: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  emptyAction: { marginTop: spacing.sm },
}));
