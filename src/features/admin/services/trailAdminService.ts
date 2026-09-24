import { apiFetch } from "@/services/api";

export type TrailDifficulty = "beginner" | "intermediate" | "advanced";

export interface AdminTrail {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  difficulty: TrailDifficulty;
  order_index: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  /** O currículo carregou. Um trilho sem isto não se publica. */
  loaded: boolean;
}

export const trailAdminService = {
  async list(): Promise<AdminTrail[]> {
    const data = await apiFetch<{ trails: AdminTrail[] }>("/admin/trails");
    return data.trails;
  },

  async publish(id: string): Promise<AdminTrail> {
    const data = await apiFetch<{ trail: AdminTrail }>(`/admin/trails/${id}/publish`, {
      method: "POST",
    });
    return data.trail;
  },

  async unpublish(id: string): Promise<AdminTrail> {
    const data = await apiFetch<{ trail: AdminTrail }>(`/admin/trails/${id}/unpublish`, {
      method: "POST",
    });
    return data.trail;
  },
};
