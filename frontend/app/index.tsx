import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/src/auth/auth-context";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { user, booting } = useAuth();
  const { colors } = useTheme();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)" : "/sign-in"} />;
}
