import { apiFetch } from "@/services/api";
import { userRepository } from "@/data";
import type { FollowListUser, SuggestedUser, User, UserStats, UserUpdate } from "@/types/user";

export const userService = {
  getById(id: string) {
    return userRepository.getById(id);
  },

  update(id: string, patch: UserUpdate) {
    return userRepository.update(id, patch);
  },

  async me(): Promise<User> {
    const data = await apiFetch<{ user: User }>("/users/me");
    return data.user;
  },

  /** Estatísticas reais do perfil. Substitui DEMO_PROFILE_STATS. */
  async stats(id: string): Promise<UserStats> {
    const data = await apiFetch<{ stats: UserStats }>(`/users/${id}/stats`);
    return data.stats;
  },

  async suggestions(): Promise<SuggestedUser[]> {
    const data = await apiFetch<{ users: SuggestedUser[] }>("/users/suggestions");
    return data.users;
  },

  /**
   * Descarrega tudo o que a aplicação sabe sobre mim.
   *
   * Não passa pelo `apiFetch`: este é o único pedido cuja resposta não é para
   * ler, é para gravar em ficheiro.
   */
  async exportData(): Promise<{ blob: Blob; filename: string }> {
    const response = await apiFetch<Record<string, unknown>>("/users/me/export");
    const blob = new Blob([JSON.stringify(response, null, 2)], { type: "application/json" });
    const dia = new Date().toISOString().slice(0, 10);
    return { blob, filename: `chefxp-dados-${dia}.json` };
  },

  async deleteAccount(input: { confirmUsername: string; password?: string }): Promise<void> {
    await apiFetch("/users/me", { method: "DELETE", body: JSON.stringify(input) });
  },

  async followers(id: string): Promise<FollowListUser[]> {
    const data = await apiFetch<{ users: FollowListUser[] }>(`/users/${id}/followers`);
    return data.users;
  },

  async following(id: string): Promise<FollowListUser[]> {
    const data = await apiFetch<{ users: FollowListUser[] }>(`/users/${id}/following`);
    return data.users;
  },

  async follow(id: string): Promise<void> {
    await apiFetch(`/users/${id}/follow`, { method: "POST" });
  },

  async unfollow(id: string): Promise<void> {
    await apiFetch(`/users/${id}/follow`, { method: "DELETE" });
  },
};
