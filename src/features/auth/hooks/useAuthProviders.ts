import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";

/**
 * O botão da Google só aparece se o servidor tiver credenciais.
 *
 * Sem isto, uma instalação sem SSO configurado mostrava um botão que levava
 * a um 404 — pior do que não ter botão nenhum.
 */
export function useAuthProviders() {
  return useQuery({
    queryKey: ["authProviders"],
    queryFn: () => apiFetch<{ google: boolean }>("/auth/providers"),
    staleTime: Infinity,
  });
}
