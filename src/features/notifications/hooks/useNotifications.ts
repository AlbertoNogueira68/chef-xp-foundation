import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../services/notificationService";
import type { NotificationPage } from "@/types/notification";

export const NOTIFICATIONS_ROOT_KEY = "notifications";
export const unreadCountQueryKey = [NOTIFICATIONS_ROOT_KEY, "unread-count"] as const;

/**
 * A contagem do sino.
 *
 * Sem websockets: pergunta-se de quinze em quinze segundos e ao voltar à
 * janela. Não abre uma ligação permanente por cada pessoa com a app aberta, e
 * o pedido é um `count` com índice parcial — barato de propósito.
 *
 * Quinze segundos e não sessenta, que foi o primeiro palpite: com um minuto,
 * quem está a experimentar a app com outra pessoa faz a ação, olha para o sino,
 * não vê nada e conclui — com razão — que aquilo não funciona. O tempo até
 * aparecer é a funcionalidade; não é um detalhe de afinação.
 *
 * `refetchIntervalInBackground` fica como vem (falso): com o separador
 * escondido não se pergunta nada, e ao voltar o foco pergunta-se logo.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: unreadCountQueryKey,
    queryFn: () => notificationService.unreadCount(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    retry: false,
  });
}

/** A lista, carregada só quando a caixa abre. */
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: [NOTIFICATIONS_ROOT_KEY, "list"],
    queryFn: () => notificationService.list(),
    enabled,
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllRead(),

    // O ponto vermelho desaparece assim que se abre a caixa: esperar pelo
    // servidor para apagar um ponto seria pior do que assumir.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [NOTIFICATIONS_ROOT_KEY] });
      const anterior = queryClient.getQueryData<number>(unreadCountQueryKey);
      queryClient.setQueryData(unreadCountQueryKey, 0);
      return { anterior };
    },

    onError: (_error, _variables, context) => {
      queryClient.setQueryData(unreadCountQueryKey, context?.anterior ?? 0);
    },

    onSuccess: () => {
      queryClient.setQueryData<NotificationPage>([NOTIFICATIONS_ROOT_KEY, "list"], (old) =>
        old
          ? {
              ...old,
              unread: 0,
              notifications: old.notifications.map((n) => ({ ...n, read: true })),
            }
          : old,
      );
    },
  });
}
