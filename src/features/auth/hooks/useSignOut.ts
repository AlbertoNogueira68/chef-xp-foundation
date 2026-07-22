import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => authService.signOut(),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      navigate("/auth", { replace: true });
    },
  });
}
