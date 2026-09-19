import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { moderationService } from "../services/moderationService";
import type { ReportInput } from "@/types/moderation";
import { t } from "@/i18n";

export const blockedUsersQueryKey = ["blockedUsers"] as const;

export function useReport() {
  return useMutation({
    mutationFn: (input: ReportInput) => moderationService.report(input),
    onSuccess: () => {
      toast.success(t("Report sent"), {
        description: t("A moderator will look at this. Thanks for flagging it."),
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("Couldn't send the report"));
    },
  });
}

/**
 * Bloquear muda o que se vê em quase todo o lado — feed, pesquisa, perfis,
 * comentários, sugestões, sino —, por isso o que se invalida a seguir é
 * praticamente tudo. Ser preciso aqui seria enganar-se num ecrã.
 */
export function useToggleBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      blocked ? moderationService.unblock(id) : moderationService.block(id),

    onSuccess: (_data, { blocked }) => {
      toast.success(blocked ? t("Account unblocked") : t("Account blocked"), {
        description: blocked
          ? "Volta a aparecer-te no feed e na pesquisa."
          : t("You stop seeing what they post, and they stop seeing you."),
      });
    },

    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("Couldn't block"));
    },

    onSettled: () => {
      for (const key of [
        ["recipes"],
        ["comments"],
        ["userStats"],
        ["suggestedChefs"],
        ["followList"],
        ["notifications"],
        blockedUsersQueryKey,
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useBlockedUsers(enabled = true) {
  return useQuery({
    queryKey: blockedUsersQueryKey,
    queryFn: () => moderationService.blocked(),
    enabled,
  });
}
