import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";

type ToastType = "default" | "success" | "error";
type ToastState = { message: string; type: ToastType } | null;

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const show = useCallback(
    (message: string, type: ToastType = "default") => {
      setToast({ message, type });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          setToast(null);
        });
      }, 2600);
    },
    [opacity],
  );

  const bg =
    toast?.type === "success"
      ? colors.success
      : toast?.type === "error"
        ? colors.error
        : colors.surfaceInverse;
  const fg =
    toast?.type === "success"
      ? colors.onSuccess
      : toast?.type === "error"
        ? colors.onError
        : colors.onSurfaceInverse;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { opacity, bottom: insets.bottom + spacing["3xl"] }]}
        >
          <View style={[styles.toast, { backgroundColor: bg }]} testID="toast">
            <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const useStyles = makeStyles(() => ({
  wrap: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    alignItems: "center",
  },
  toast: {
    maxWidth: "100%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: "center",
  },
}));
