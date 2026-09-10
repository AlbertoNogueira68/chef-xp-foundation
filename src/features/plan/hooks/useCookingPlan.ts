import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { planService } from "../services/planService";
import type { PlanInput } from "@/types/plan";

export const PLAN_QUERY_KEY = ["cookingPlan"] as const;

export function useCookingPlan() {
  return useQuery({
    queryKey: PLAN_QUERY_KEY,
    queryFn: () => planService.get(),
  });
}

export function useSavePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlanInput) => planService.save(input),
    // A resposta já traz o estado da semana recalculado — não vale a pena
    // pedi-lo outra vez.
    onSuccess: (state) => queryClient.setQueryData(PLAN_QUERY_KEY, state),
  });
}

export function useRemovePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => planService.remove(),
    onSuccess: (state) => queryClient.setQueryData(PLAN_QUERY_KEY, state),
  });
}
