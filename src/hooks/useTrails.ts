import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";

export interface Trail {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  published_at?: string;
  order_index: number;
}

export interface UserTrail extends Trail {
  started_at: string;
  current_unit_id?: string;
}

const trailsQueryKey = ["trails"] as const;
const userTrailsQueryKey = ["userTrails"] as const;

export function useTrails() {
  return useQuery({
    queryKey: trailsQueryKey,
    queryFn: async () => {
      const data = await apiFetch<{ trails: Trail[] }>("/learning/trails");
      return data.trails;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUserTrails() {
  return useQuery({
    queryKey: userTrailsQueryKey,
    queryFn: async () => {
      const data = await apiFetch<{ trails: UserTrail[] }>("/learning/my-trails");
      return data.trails;
    },
    staleTime: 30_000, // 30 seconds
  });
}

export function useStartTrail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trailId: string) =>
      apiFetch<{ success: boolean; progress: object }>(`/learning/trails/${trailId}/start`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userTrailsQueryKey });
    },
  });
}

export function useSelectTrail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trailId: string) =>
      apiFetch<{ success: boolean; progress: object }>(`/learning/trails/${trailId}/select`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userTrailsQueryKey });
    },
  });
}

export function useDeleteTrail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trailId: string) =>
      apiFetch<{ success: boolean; deleted: boolean }>(`/learning/trails/${trailId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userTrailsQueryKey });
    },
  });
}

export function useInvalidateTrails() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: trailsQueryKey });
    queryClient.invalidateQueries({ queryKey: userTrailsQueryKey });
  };
}
