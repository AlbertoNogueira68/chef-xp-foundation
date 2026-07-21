import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { authService } from "../services/authService";

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => authService.signOut(),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await router.navigate({ to: "/auth", replace: true });
    },
  });
}
