import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { challengeService } from "../services/challengeService";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";
import type { Challenge } from "@/types/challenge";
import type { ApiError } from "@/services/api";

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

      // `earned: 0` não é um erro: já tinhas ganho o XP deste desafio antes.
      toast.success(
        xp.earned > 0 ? `Participação registada · +${xp.earned} XP` : "Participação registada",
      );
    },

    onError: (error: ApiError) => {
      toast.error(error.message || "Não foi possível participar");
    },
  });
}

export function useLeaveChallenge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => challengeService.leave(id),
    onSuccess: (challenge) => {
      patchChallenge(queryClient, challenge);
      toast.success("Participação retirada");
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Não foi possível retirar a participação");
    },
  });
}
