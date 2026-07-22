import { useQuery, useQueryClient } from "@tanstack/react-query";
import { learningService } from "../services/learningService";

export const learningPathQueryKey = ["learningPath"] as const;

export function useLearningPath() {
  return useQuery({
    queryKey: learningPathQueryKey,
    queryFn: () => learningService.getPath(),
    staleTime: 30_000,
  });
}

export function useInvalidateLearningPath() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: learningPathQueryKey });
}
