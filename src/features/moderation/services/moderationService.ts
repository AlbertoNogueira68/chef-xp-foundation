import { apiFetch } from "@/services/api";
import type { BlockedUser, ReportInput } from "@/types/moderation";

export const moderationService = {
  /**
   * Denunciar. A resposta é a mesma quer seja a primeira denúncia sobre aquele
   * conteúdo quer seja a décima — o servidor não conta ao denunciante quantas
   * outras pessoas já o fizeram.
   */
  report(input: ReportInput): Promise<{ reported: boolean }> {
    return apiFetch<{ reported: boolean }>("/reports", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  block(userId: string): Promise<{ blocked: boolean }> {
    return apiFetch<{ blocked: boolean }>(`/users/${userId}/block`, { method: "POST" });
  },

  unblock(userId: string): Promise<{ blocked: boolean }> {
    return apiFetch<{ blocked: boolean }>(`/users/${userId}/block`, { method: "DELETE" });
  },

  async blocked(): Promise<BlockedUser[]> {
    const data = await apiFetch<{ users: BlockedUser[] }>("/users/me/blocks");
    return data.users;
  },
};
