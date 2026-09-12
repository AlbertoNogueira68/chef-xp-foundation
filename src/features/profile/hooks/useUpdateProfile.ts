import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userService } from "@/features/profile/services/userService";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";
import type { User, UserUpdate } from "@/types/user";

/**
 * Editar o próprio perfil.
 *
 * O `id` vai para o repositório por causa do contrato, mas o servidor só aceita
 * `PATCH /users/me`: ninguém edita o perfil de outra pessoa por engano.
 */
export function useUpdateProfile(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UserUpdate) => userService.update(userId as string, patch),

    onSuccess: (user: User) => {
      queryClient.setQueryData(currentUserQueryKey, user);
      queryClient.invalidateQueries({ queryKey: ["userProfile", user.id] });
      // O nome e a fotografia aparecem em cada receita e comentário.
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      toast.success("Perfil atualizado");
    },

    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível guardar");
    },
  });
}
