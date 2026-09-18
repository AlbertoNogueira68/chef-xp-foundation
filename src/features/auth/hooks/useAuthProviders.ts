import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";

/**
 * O que o servidor tem ligado.
 *
 * O botão da Google só aparece se houver credenciais, e o link de "esqueci-me
 * da password" só aparece se houver SMTP. Sem isto, uma instalação sem SSO
 * mostrava um botão que levava a um 404 — pior do que não ter botão nenhum.
 */
export function useAuthProviders() {
  return useQuery({
    queryKey: ["authProviders"],
    queryFn: () =>
      apiFetch<{
        google: boolean;
        passwordRecovery: boolean;
        /**
         * "verified": o email é confirmado antes de a conta existir.
         * "direct": sem SMTP não há como confirmar nada, e o registo é de uma
         * vez só. O formulário pergunta antes de se desenhar, em vez de
         * assumir um dos dois e falhar na instalação de quem escolheu o outro.
         */
        signupFlow: "verified" | "direct";
      }>("/auth/providers"),
    staleTime: Infinity,
  });
}
