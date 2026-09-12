import { useQuery } from "@tanstack/react-query";
import { userService } from "@/features/profile/services/userService";

export const userProfileQueryKey = (id: string | undefined) => ["userProfile", id ?? ""] as const;

/**
 * O perfil público de outra pessoa.
 *
 * Vai pelo repositório (`userService.getById`), ao contrário das estatísticas,
 * porque é o utilizador — o domínio que ainda passa pelo `Repository` para o
 * provider poder ser trocado num só ficheiro.
 */
export function useUserProfile(id: string | undefined) {
  return useQuery({
    queryKey: userProfileQueryKey(id),
    queryFn: () => userService.getById(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
