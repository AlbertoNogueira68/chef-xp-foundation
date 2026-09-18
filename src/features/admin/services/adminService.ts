import { apiFetch } from "@/services/api";
import type { AdminUser, ModerationReport, PlatformMetrics } from "@/types/admin";
import type { UserRole } from "@/types/user";

export const adminService = {
  async metrics(): Promise<PlatformMetrics> {
    const data = await apiFetch<{ metrics: PlatformMetrics }>("/admin/metrics");
    return data.metrics;
  },

  async users(params: { q?: string; role?: string } = {}): Promise<AdminUser[]> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.role && params.role !== "all") search.set("role", params.role);
    const qs = search.toString();
    const data = await apiFetch<{ users: AdminUser[] }>(`/admin/users${qs ? `?${qs}` : ""}`);
    return data.users;
  },

  async setRole(
    id: string,
    role: UserRole,
  ): Promise<{ id: string; username: string; role: UserRole }> {
    const data = await apiFetch<{ user: { id: string; username: string; role: UserRole } }>(
      `/admin/users/${id}/role`,
      { method: "PATCH", body: JSON.stringify({ role }) },
    );
    return data.user;
  },

  /** A fila. Aberta a moderadores e a administradores. */
  async reports(status: string): Promise<{ reports: ModerationReport[]; open: number }> {
    return apiFetch<{ reports: ModerationReport[]; open: number }>(
      `/moderation/reports?status=${status}`,
    );
  },

  resolve(id: string, action: "remover" | "arquivar"): Promise<{ resolved: number }> {
    return apiFetch<{ resolved: number }>(`/moderation/reports/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  },
};
