import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trailAdminService, type AdminTrail } from "../services/trailAdminService";

export const adminTrailsQueryKey = ["admin", "trails"] as const;

export function useAdminTrails() {
  return useQuery({
    queryKey: adminTrailsQueryKey,
    queryFn: () => trailAdminService.list(),
    staleTime: 30_000,
  });
}

/**
 * Publicar/despublicar invalidam a mesma lista, e mexem no que quem aprende
 * vê — é por isso que as queries do lado do aluno caem com elas.
 */
function useTrailMutation(fn: (id: string) => Promise<AdminTrail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminTrailsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["trails"] });
      queryClient.invalidateQueries({ queryKey: ["userTrails"] });
    },
  });
}

export function usePublishTrail() {
  return useTrailMutation((id: string) => trailAdminService.publish(id));
}

export function useUnpublishTrail() {
  return useTrailMutation((id: string) => trailAdminService.unpublish(id));
}
