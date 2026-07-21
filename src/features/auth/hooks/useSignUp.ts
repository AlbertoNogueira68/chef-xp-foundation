import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/authService";
import type { RegisterInput } from "../schemas";

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => authService.signUp(input),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
