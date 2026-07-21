import { useMutation } from "@tanstack/react-query";
import { authService } from "../services/authService";

export function useSignInWithGoogle() {
  return useMutation({
    mutationFn: () => authService.signInWithGoogle(),
  });
}
