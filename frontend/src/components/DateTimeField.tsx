import { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Ionicons from "@react-native-vector-icons/ionicons";

import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";

const pad = (n: number) => String(n).padStart(2, "0");
export const fmtDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

type Props = { value: Date; onChange: (d: Date) => void; testID?: string };

/** Date + time picker: native scroll wheels on iOS/Android, plain text fields on web. */
export function DateTimeField({ value, onChange, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState<"date" | "time" | null>(null);

  if (Platform.OS === "web") {
    return <WebDateTime value={value} onChange={onChange} testID={testID} />;
  }

  const onPick = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === "android") setOpen(null);
    if (e.type === "dismissed" || !d) return;
    onChange(d);
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.row}>
        <Pressable style={[styles.chip, open === "date" && styles.chipOn]} onPress={() => setOpen(open === "date" ? null : "date")} testID={`${testID}-date`}>
          <Ionicons name="calendar" size={18} color={colors.brand} />
          <Text style={styles.chipText}>{fmtDate(value)}</Text>
        </Pressable>
        <Pressable style={[styles.chip, open === "time" && styles.chipOn]} onPress={() => setOpen(open === "time" ? null : "time")} testID={`${testID}-time`}>
          <Ionicons name="time" size={18} color={colors.brand} />
          <Text style={styles.chipText}>{fmtTime(value)}</Text>
        </Pressable>
      </View>
      {open ? (
        <DateTimePicker
          value={value}
          mode={open}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPick}
          maximumDate={new Date()}
          themeVariant={undefined}
          textColor={colors.onSurface}
          style={styles.spinner}
        />
      ) : null}
    </View>
  );
}

function WebDateTime({ value, onChange, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [date, setDate] = useState(fmtDate(value));
  const [time, setTime] = useState(fmtTime(value));

  const commit = (dStr: string, tStr: string) => {
    const [dd, mm, yyyy] = dStr.split("/").map((x) => parseInt(x, 10));
    const [hh, mi] = tStr.split(":").map((x) => parseInt(x, 10));
    if ([dd, mm, yyyy, hh, mi].some((n) => isNaN(n))) return;
    const d = new Date(yyyy, mm - 1, dd, hh, mi);
    if (!isNaN(d.getTime())) onChange(d);
  };

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.col}>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={(v) => { setDate(v); commit(v, time); }}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.muted}
          testID={`${testID}-date`}
        />
        <Text style={styles.subLabel}>Date</Text>
      </View>
      <View style={styles.col}>
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={(v) => { setTime(v); commit(date, v); }}
          placeholder="HH:MM"
          placeholderTextColor={colors.muted}
          testID={`${testID}-time`}
        />
        <Text style={styles.subLabel}>Time (24hr)</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md },
  col: { flex: 1, gap: spacing.xs },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  chipOn: { borderColor: colors.brand },
  chipText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  spinner: { alignSelf: "stretch" },
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
  subLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
}));
