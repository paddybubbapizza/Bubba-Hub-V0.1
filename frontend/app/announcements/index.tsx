import { useState } from "react";
import { Alert, Platform, RefreshControl, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/auth-context";
import { AnnouncementCard } from "@/src/components/AnnouncementCard";
import { Header } from "@/src/components/Header";
import { Button, EmptyState } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { makeStyles, useTheme, fonts, spacing } from "@/src/theme";
import type { Announcement } from "@/src/types";

export default function Announcements() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);

  const { data: anns = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api<Announcement[]>("/announcements"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast("Announcement deleted", "success");
    },
    onError: (e: any) => toast(e?.message ?? "Could not delete", "error"),
  });

  const confirmDelete = (a: Announcement) => {
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Delete "${a.title}"?`)) remove.mutate(a.id);
      return;
    }
    Alert.alert("Delete this announcement?", a.title, [
      { text: "Keep it", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate(a.id) },
    ]);
  };

  const mine = anns.filter((a) => a.canEdit);
  const others = anns.filter((a) => !a.canEdit);
  const subtitle = user?.co ? "Posting to everyone" : `Posting to ${(user?.stores ?? []).join(" · ")}`;

  const renderCard = (a: Announcement) => (
    <AnnouncementCard
      key={a.id}
      announcement={a}
      expanded={open === a.id}
      onToggle={() => setOpen(open === a.id ? null : a.id)}
      testID={`ann-card-${a.id}`}
      actions={
        a.canEdit ? (
          <View style={styles.actions}>
            <Text style={styles.readCount}>Read by {a.readCount}</Text>
            <View style={styles.actionBtns}>
              <Button title="Edit" small variant="outline" icon="create-outline" onPress={() => router.push({ pathname: "/announcement/new", params: { id: a.id } })} testID={`ann-edit-${a.id}`} />
              <Button title="Delete" small variant="ghost" icon="trash-outline" onPress={() => confirmDelete(a)} testID={`ann-delete-${a.id}`} />
            </View>
          </View>
        ) : null
      }
    />
  );

  return (
    <View style={styles.container}>
      <Header title="Announcements" subtitle={subtitle} showBack onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      >
        <Button title="New Announcement" icon="megaphone" onPress={() => router.push("/announcement/new")} testID="new-announcement-button" />

        {isLoading ? null : anns.length === 0 ? (
          <EmptyState icon="megaphone" title="No announcements yet" message="Post an update and your team will see it on their home screen." />
        ) : (
          <>
            <Text style={styles.sectionTitle}>You can edit</Text>
            {mine.length === 0 ? <Text style={styles.none}>Nothing you can edit yet.</Text> : mine.map(renderCard)}
            {others.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>From head office and above</Text>
                {others.map(renderCard)}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.onSurface, marginTop: spacing.sm },
  none: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, paddingVertical: spacing.sm },
  actions: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  readCount: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  actionBtns: { flexDirection: "row", gap: spacing.sm },
}));
