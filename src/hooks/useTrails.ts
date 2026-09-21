import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";

export interface Trail {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  order_index: number;
  /** O servidor já cruzou com a inscrição: evita o cartão piscar entre
      "Começar" e "Continuar" enquanto a segunda lista não chega. */
  started: boolean;
}

export interface UserTrail extends Omit<Trail, "started"> {
  started_at: string;
  completed_at: string | null;
  current_unit_id: string | null;
}

export const trailsQueryKey = ["trails"] as const;
export const userTrailsQueryKey = ["userTrails"] as const;

export function useTrails() {
  return useQuery({
    queryKey: trailsQueryKey,
    queryFn: async () => (await apiFetch<{ trails: Trail[] }>("/learning/trails")).trails,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserTrails() {
  return useQuery({
    queryKey: userTrailsQueryKey,
    queryFn: async () => (await apiFetch<{ trails: UserTrail[] }>("/learning/my-trails")).trails,
    staleTime: 30_000,
  });
}

function useTrailEnrolment(fn: (trailId: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trailsQueryKey });
      queryClient.invalidateQueries({ queryKey: userTrailsQueryKey });
    },
  });
}

export function useStartTrail() {
  return useTrailEnrolment((trailId) =>
    apiFetch(`/learning/trails/${trailId}/start`, { method: "POST" }),
  );
}
