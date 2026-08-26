import { apiFetch } from "@/services/api";
import { userRepository } from "@/data";
import type { SuggestedUser, User, UserStats, UserUpdate } from "@/types/user";

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

  async follow(id: string): Promise<void> {
    await apiFetch(`/users/${id}/follow`, { method: "POST" });
  },

  async unfollow(id: string): Promise<void> {
    await apiFetch(`/users/${id}/follow`, { method: "DELETE" });
  },
};
