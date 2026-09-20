import { useQuery, useQueryClient } from "@tanstack/react-query";
import { learningService } from "../services/learningService";
import type { LearningPath } from "@/types/learning";

export const learningPathQueryKey = (trailId?: string) => ["learningPath", trailId] as const;

export function useLearningPath(trailId?: string) {
  return useQuery({
    queryKey: learningPathQueryKey(trailId),
    queryFn: () => learningService.getPath(trailId),
    staleTime: 15_000,
  });
}

export function useInvalidateLearningPath(trailId?: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: learningPathQueryKey(trailId) });
}

/** O servidor devolve o percurso já atualizado ao concluir uma lição. */
export function useSetLearningPath(trailId?: string) {
  const queryClient = useQueryClient();
  return (path: LearningPath) => queryClient.setQueryData(learningPathQueryKey(trailId), path);
}
