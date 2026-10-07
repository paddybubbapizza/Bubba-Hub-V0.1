import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useAuth } from "@/src/auth/auth-context";
import { useTheme, fonts } from "@/src/theme";

export default function TabsLayout() {
  const { user } = useAuth();
  const { colors } = useTheme();

  if (!user) return <Redirect href="/sign-in" />;

  const canManage = user.role === "Company account" || user.role === "Franchisee";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="checks"
        options={{
          title: "Checks",
          tabBarIcon: ({ color, size }) => <Ionicons name="checkbox" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: "Manage",
          href: canManage ? "/(tabs)/manage" : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
