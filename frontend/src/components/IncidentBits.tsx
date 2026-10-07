import { Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";
import type { Incident } from "@/src/types";

export function useUrgencyColor() {
  const { colors } = useTheme();
  return (urgency: string) =>
    urgency === "Critical" || urgency === "High" ? colors.error : urgency === "Medium" ? colors.warning : colors.success;
}

export function UrgencyPill({ urgency }: { urgency: string }) {
  const styles = useStyles();
  const color = useUrgencyColor()(urgency);
  return (
    <View style={[styles.pill, { backgroundColor: color }]} testID={`urgency-${urgency}`}>
      <Text style={styles.pillText}>{urgency}</Text>
    </View>
  );
}

export function IncidentStatusBadge({ incident }: { incident: Incident }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const done = incident.status === "completed";
  const color = done ? colors.success : colors.muted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Ionicons name={done ? "checkmark-circle" : "time-outline"} size={14} color={color} />
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {done ? `Completed · ${incident.rev}` : "Pending review"}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  pill: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10, alignSelf: "flex-start" },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onBrand },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
  },
  badgeText: { fontFamily: fonts.medium, fontSize: 12 },
}));
