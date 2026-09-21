import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trailAdminService, type AdminTrail, type TrailDraft } from "../services/trailAdminService";

export const adminTrailsQueryKey = ["admin", "trails"] as const;

export function useAdminTrails() {
  return useQuery({
    queryKey: adminTrailsQueryKey,
    queryFn: () => trailAdminService.list(),
    staleTime: 30_000,
  });
}

/** O trilho com o currículo, para o formulário de edição o poder mostrar. */
export function useTrailDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin", "trails", id, "detail"],
    queryFn: () => trailAdminService.get(id as string),
    enabled: id !== null,
  });
}

/**
 * Tudo o que muda um trilho invalida a mesma lista, por isso partilham o
 * `onSuccess`. Publicar também mexe no que quem aprende vê, e é por isso que
 * as queries do lado do aluno caem com ele.
 */
function useTrailMutation<TArgs>(fn: (args: TArgs) => Promise<AdminTrail | string>) {
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

export function useCreateTrail() {
  return useTrailMutation((draft: TrailDraft) => trailAdminService.create(draft));
}

export function useUpdateTrail() {
  return useTrailMutation(({ id, patch }: { id: string; patch: Partial<TrailDraft> }) =>
    trailAdminService.update(id, patch),
  );
}

export function usePublishTrail() {
  return useTrailMutation((id: string) => trailAdminService.publish(id));
}

export function useUnpublishTrail() {
  return useTrailMutation((id: string) => trailAdminService.unpublish(id));
}

export function useDeleteTrail() {
  return useTrailMutation((id: string) => trailAdminService.remove(id));
}
