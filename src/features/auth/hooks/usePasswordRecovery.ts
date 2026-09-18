import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";
import { authService } from "../services/authService";
import type { ResetPasswordInput } from "../schemas";

/**
 * Pedir o link de recuperação.
 *
 * Não distingue "enviado" de "não há conta com esse email": o servidor
 * responde o mesmo aos dois casos, e o ecrã diz o mesmo aos dois — quem
 * escreveu o endereço errado fica a saber que deve verificar o que escreveu,
 * sem que isso confirme a ninguém quem tem conta aqui.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authService.requestPasswordReset(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => authService.resetPassword(input),
  });
}

export function useSendEmailVerification() {
  return useMutation({
    mutationFn: () => authService.sendEmailVerification(),
  });
}

/**
 * Confirmar o email a partir do link.
 *
 * É uma `useQuery` e não uma `useMutation`, apesar de por baixo ser um POST.
 *
 * A primeira versão era uma mutação disparada num `useEffect` de arranque, e
 * ficava em "A confirmar…" para sempre: o pedido chegava ao servidor, o email
 * ficava confirmado, a promessa resolvia — e o ecrã nunca mais era desenhado.
 * A causa é o `StrictMode`, que em desenvolvimento monta, desmonta e volta a
 * montar: o observador da mutação é desligado a meio do pedido e, quando a
 * resposta chega, já não há ninguém a ouvir. Uma `useQuery` é feita
 * precisamente para "correr quando o ecrã abre" e aguenta esse ciclo.
 *
 * O que torna isto seguro é a rota ser idempotente por desenho: abrir o mesmo
 * link duas vezes responde `alreadyVerified` em vez de dar erro.
 */
export function useVerifyEmail(token: string) {
  const queryClient = useQueryClient();

  const confirmacao = useQuery({
    queryKey: ["verifyEmail", token],
    queryFn: () => authService.verifyEmail(token),
    enabled: Boolean(token),
    // Um token inválido é inválido — repetir só o confirma mais devagar.
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // O perfil mostra `emailVerified`. Invalida-se só essa chave, e nunca tudo:
  // um `invalidateQueries()` sem filtro apanhava esta própria query e o ecrã
  // voltava a chamar a rota em ciclo.
  const confirmado = confirmacao.isSuccess;
  useEffect(() => {
    if (confirmado) queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
  }, [confirmado, queryClient]);

  return confirmacao;
}
