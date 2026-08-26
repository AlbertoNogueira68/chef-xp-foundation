import { useQuery, useQueryClient } from "@tanstack/react-query";
import { learningService } from "../services/learningService";
import type { LearningPath } from "@/types/learning";

export const learningPathQueryKey = ["learningPath"] as const;

export function useLearningPath() {
  return useQuery({
    queryKey: learningPathQueryKey,
    queryFn: () => learningService.getPath(),
    staleTime: 15_000,
  });
}

export function useInvalidateLearningPath() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: learningPathQueryKey });
}

/** O servidor devolve o percurso já atualizado ao concluir uma lição. */
export function useSetLearningPath() {
  const queryClient = useQueryClient();
  return (path: LearningPath) => queryClient.setQueryData(learningPathQueryKey, path);
}
