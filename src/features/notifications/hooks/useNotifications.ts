import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../services/notificationService";
import type { NotificationPage } from "@/types/notification";

export const NOTIFICATIONS_ROOT_KEY = "notifications";
export const unreadCountQueryKey = [NOTIFICATIONS_ROOT_KEY, "unread-count"] as const;

/**
 * A contagem do sino.
 *
 * Sem websockets: pergunta-se de minuto a minuto e ao voltar à janela. Para
 * uma app de cozinha é mais do que suficiente, e não abre uma ligação
 * permanente por cada pessoa que tem a app aberta.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: unreadCountQueryKey,
    queryFn: () => notificationService.unreadCount(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
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
