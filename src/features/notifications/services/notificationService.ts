import { apiFetch } from "@/services/api";
import type { NotificationPage } from "@/types/notification";

export const notificationService = {
  list(unreadOnly = false): Promise<NotificationPage> {
    return apiFetch<NotificationPage>(`/notifications?unreadOnly=${unreadOnly}`);
  },

  /** Só a contagem: é o que o sino precisa, e não puxa a lista toda. */
  async unreadCount(): Promise<number> {
    const data = await apiFetch<{ unread: number }>("/notifications/unread-count");
    return data.unread;
  },

  async markAllRead(): Promise<void> {
    await apiFetch("/notifications/read", { method: "POST" });
  },
};
