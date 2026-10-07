// Design tokens for Bubba Pizza Hub. Light + dark themes, brand red/black.
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#f5f5f5",
  onSurface: "#111111",
  surfaceSecondary: "#ffffff",
  onSurfaceSecondary: "#111111",
  surfaceTertiary: "#e5e5e5",
  onSurfaceTertiary: "#111111",
  surfaceInverse: "#111111",
  onSurfaceInverse: "#ffffff",
  muted: "#737373",

  brand: "#d7141a",
  onBrand: "#ffffff",
  brandPrimary: "#d7141a",
  onBrandPrimary: "#ffffff",
  brandSecondary: "#a10f13",
  onBrandSecondary: "#ffffff",
  brandTertiary: "#fad4d5",
  onBrandTertiary: "#d7141a",

  success: "#1d7a46",
  onSuccess: "#ffffff",
  warning: "#f59e0b",
  onWarning: "#ffffff",
  error: "#d7141a",
  onError: "#ffffff",
  info: "#525252",
  onInfo: "#ffffff",

  border: "#e5e5e5",
  borderStrong: "#d4d4d4",
  divider: "#e5e5e5",
};

const dark: typeof light = {
  surface: "#121212",
  onSurface: "#f5f5f5",
  surfaceSecondary: "#1c1c1c",
  onSurfaceSecondary: "#f5f5f5",
  surfaceTertiary: "#262626",
  onSurfaceTertiary: "#f5f5f5",
  surfaceInverse: "#f5f5f5",
  onSurfaceInverse: "#111111",
  muted: "#a3a3a3",

  brand: "#ff5a60",
  onBrand: "#111111",
  brandPrimary: "#ff5a60",
  onBrandPrimary: "#111111",
  brandSecondary: "#ff8a8e",
  onBrandSecondary: "#111111",
  brandTertiary: "#3b1114",
  onBrandTertiary: "#ff5a60",

  success: "#2e9a5a",
  onSuccess: "#ffffff",
  warning: "#fbbf24",
  onWarning: "#111111",
  error: "#ff5a60",
  onError: "#111111",
  info: "#a3a3a3",
  onInfo: "#111111",

  border: "#262626",
  borderStrong: "#404040",
  divider: "#262626",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

// Figtree font families loaded in app/_layout.tsx. Max weight 500 by design;
// semibold/extrabold reserved for the logo wordmark only.
export const fonts = {
  regular: "Figtree-Regular",
  medium: "Figtree-Medium",
  semibold: "Figtree-SemiBold",
  extrabold: "Figtree-ExtraBold",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Both themes ship: let the device decide.
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
