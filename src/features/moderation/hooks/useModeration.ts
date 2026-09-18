import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { moderationService } from "../services/moderationService";
import type { ReportInput } from "@/types/moderation";

export const blockedUsersQueryKey = ["blockedUsers"] as const;

export function useReport() {
  return useMutation({
    mutationFn: (input: ReportInput) => moderationService.report(input),
    onSuccess: () => {
      toast.success("Denúncia enviada", {
        description: "Alguém da moderação vai ver isto. Obrigado por avisares.",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a denúncia");
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
      toast.success(blocked ? "Conta desbloqueada" : "Conta bloqueada", {
        description: blocked
          ? "Volta a aparecer-te no feed e na pesquisa."
          : "Deixas de ver o que publica, e ela deixa de te ver a ti.",
      });
    },

    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível bloquear");
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
