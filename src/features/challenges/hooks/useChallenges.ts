import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { challengeService } from "../services/challengeService";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";
import type { Challenge, ChallengeDraft, ChallengeEdit } from "@/types/challenge";
import type { ApiError } from "@/services/api";
import { t } from "@/i18n";

export const CHALLENGES_ROOT_KEY = "challenges";

export function useChallenges() {
  return useQuery({
    queryKey: [CHALLENGES_ROOT_KEY],
    queryFn: () => challengeService.list(),
  });
}

export function useChallenge(id: string | null) {
  return useQuery({
    queryKey: [CHALLENGES_ROOT_KEY, id],
    queryFn: () => challengeService.get(id as string),
    enabled: Boolean(id),
  });
}

/** Substitui um desafio em todas as listas em cache, sem refetch. */
function patchChallenge(queryClient: ReturnType<typeof useQueryClient>, challenge: Challenge) {
  queryClient.setQueryData<Challenge[]>([CHALLENGES_ROOT_KEY], (old) =>
    old?.map((item) => (item.id === challenge.id ? challenge : item)),
  );
  queryClient.invalidateQueries({ queryKey: [CHALLENGES_ROOT_KEY, challenge.id] });
}

export function useEnterChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, recipeId }: { id: string; recipeId: string }) =>
      challengeService.enter(id, recipeId),

    onSuccess: ({ challenge, xp }) => {
      patchChallenge(queryClient, challenge);
      // O XP mudou: o cabeçalho e o perfil têm de saber.
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      queryClient.invalidateQueries({ queryKey: ["userStats"] });

      // `earned: 0` não é um erro: já tinhas ganho o XP deste desafio antes —
      // ou é a segunda foto de um desafio que aceita várias.
      toast.success(xp.earned > 0 ? t("You're in · +{xp} XP", { xp: xp.earned }) : t("You're in"));
    },

    onError: (error: ApiError) => {
      toast.error(error.message || t("Couldn't enter"));
    },
  });
}

export function useLeaveChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, entryId }: { id: string; entryId?: string }) =>
      challengeService.leave(id, entryId),
    onSuccess: (challenge) => {
      patchChallenge(queryClient, challenge);
      toast.success(t("Entry withdrawn"));
    },
    onError: (error: ApiError) => {
      toast.error(error.message || t("Couldn't withdraw the entry"));
    },
  });
}

/* ---------------------------------------------------------------- *
 * Moderação
 * ---------------------------------------------------------------- */

/**
 * Criar, editar, apagar e fechar partilham a mesma invalidação: a lista de
 * desafios é a mesma que quem participa vê, e não há uma segunda cache de
 * administração para manter sincronizada.
 */
function useChallengeAdminMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  message: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHALLENGES_ROOT_KEY] });
      toast.success(t(message));
    },
    onError: (error: ApiError) => {
      toast.error(error.message || t("That didn't work"));
    },
  });
}

export function useCreateChallenge() {
  return useChallengeAdminMutation(
    (draft: ChallengeDraft) => challengeService.create(draft),
    "Challenge created",
  );
}

export function useUpdateChallenge() {
  return useChallengeAdminMutation(
    ({ id, changes }: { id: string; changes: ChallengeEdit }) =>
      challengeService.update(id, changes),
    "Challenge updated",
  );
}

export function useDeleteChallenge() {
  return useChallengeAdminMutation(
    (id: string) => challengeService.remove(id),
    "Challenge deleted",
  );
}

/**
 * Fechar à mão um desafio que já terminou. O agendador faz o mesmo sozinho —
 * isto é para quem não quer esperar pela próxima passagem.
 */
export function useSettleChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => challengeService.settle(id),
    onSuccess: ({ challenge }) => {
      patchChallenge(queryClient, challenge);
      queryClient.invalidateQueries({ queryKey: [CHALLENGES_ROOT_KEY] });
      // O pódio pagou XP: a quem o ganhou, o cabeçalho tem de mudar.
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      toast.success(t("Ranking closed and XP paid"));
    },
    onError: (error: ApiError) => {
      toast.error(error.message || t("That didn't work"));
    },
  });
}
