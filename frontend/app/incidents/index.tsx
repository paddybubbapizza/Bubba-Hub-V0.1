import { View } from "react-native";
import { useRouter } from "expo-router";

import { Header } from "@/src/components/Header";
import { EmptyState } from "@/src/components/ui";
import { makeStyles, spacing } from "@/src/theme";

export default function Incidents() {
  const router = useRouter();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Header title="Incident Reports" showBack onBack={() => router.back()} />
      <View style={styles.body}>
        <EmptyState
          icon="warning"
          title="Incident Reports are coming next"
          message="Soon you'll be able to log an accident, injury or issue and send it straight to head office."
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1, justifyContent: "center", padding: spacing.lg },
}));
