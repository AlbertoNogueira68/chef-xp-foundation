import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/authService";
import type { LoginInput } from "../schemas";

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authService.signIn(input),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
