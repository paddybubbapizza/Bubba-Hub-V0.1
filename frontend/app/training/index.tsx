import { View } from "react-native";
import { useRouter } from "expo-router";

import { Header } from "@/src/components/Header";
import { EmptyState } from "@/src/components/ui";
import { makeStyles, spacing } from "@/src/theme";

export default function Training() {
  const router = useRouter();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Header title="Training" showBack onBack={() => router.back()} />
      <View style={styles.body}>
        <EmptyState
          icon="school"
          title="Training is coming next"
          message="Courses and how-to guides for your team will live here so everyone opens the store the right way."
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1, justifyContent: "center", padding: spacing.lg },
}));
