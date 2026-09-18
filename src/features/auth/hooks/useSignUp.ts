import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/authService";
import type { RegisterInput, SignupCompleteInput } from "../schemas";

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => authService.signUp(input),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

/**
 * Primeiro passo: pedir o link.
 *
 * Não distingue "enviado" de "esse email já tem conta", como a recuperação de
 * password: o servidor responde o mesmo aos dois, e o ecrã diz o mesmo aos
 * dois. Quem for dono da caixa percebe o que se passa pelo email que recebe.
 */
export function useStartSignup() {
  return useMutation({
    mutationFn: (email: string) => authService.startSignup(email),
  });
}

/** O link ainda vale? Perguntado antes de desenhar o formulário. */
export function useSignupToken(token: string) {
  return useQuery({
    queryKey: ["signupToken", token],
    queryFn: () => authService.checkSignupToken(token),
    enabled: Boolean(token),
    // Um link expirado não melhora com insistência.
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Segundo passo: nome e password. A conta nasce aqui, e já com sessão. */
export function useCompleteSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupCompleteInput) => authService.completeSignup(input),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
