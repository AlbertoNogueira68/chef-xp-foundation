import { apiFetch } from "@/services/api";
import type { MissionCompletion, MissionPost, MissionRunState, RescueKind } from "@/types/learning";

export const missionService = {
  /** Os cozinhados de alguém. Sem `userId`, os de quem está autenticado. */
  async posts(userId?: string): Promise<MissionPost[]> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const data = await apiFetch<{ posts: MissionPost[] }>(`/missions/posts${query}`);
    return data.posts;
  },

  /** Arranca ou retoma. O servidor decide qual — quem fechou a app a meio
   *  de cozinhar quer continuar, não recomeçar. */
  start(missionId: string): Promise<MissionRunState> {
    return apiFetch<MissionRunState>(`/missions/${missionId}/start`, { method: "POST" });
  },

  resume(missionId: string): Promise<MissionRunState> {
    return apiFetch<MissionRunState>(`/missions/${missionId}/run`);
  },

  moveToStep(runId: number, stepIndex: number): Promise<MissionRunState> {
    return apiFetch<MissionRunState>(`/missions/runs/${runId}/step`, {
      method: "PATCH",
      body: JSON.stringify({ stepIndex }),
    });
  },

  /**
   * Telemetria. Fire-and-forget de propósito: quem está a cozinhar nunca pode
   * ver um erro porque uma métrica não foi gravada.
   */
  logEvent(runId: number, kind: "timer" | "voice", stepIndex: number, detail?: string) {
    return apiFetch<void>(`/missions/runs/${runId}/events`, {
      method: "POST",
      body: JSON.stringify({ kind, stepIndex, detail: detail ?? null }),
    }).catch(() => undefined);
  },

  rescue(runId: number, stepIndex: number, kind: RescueKind) {
    return apiFetch<{ kind: RescueKind; stepIndex: number; answer: string }>(
      `/missions/runs/${runId}/rescue`,
      { method: "POST", body: JSON.stringify({ stepIndex, kind }) },
    );
  },

  checkpoint(runId: number, stepIndex: number, imageDataUrl: string) {
    return apiFetch<{ checkpoint: { stepIndex: number; imageUrl: string } }>(
      `/missions/runs/${runId}/checkpoint`,
      { method: "POST", body: JSON.stringify({ stepIndex, imageDataUrl }) },
    );
  },

  complete(runId: number, share: boolean, caption?: string): Promise<MissionCompletion> {
    return apiFetch<MissionCompletion>(`/missions/runs/${runId}/complete`, {
      method: "POST",
      body: JSON.stringify({ share, caption: caption ?? null }),
    });
  },

  abandon(runId: number) {
    return apiFetch<{ abandoned: boolean }>(`/missions/runs/${runId}/abandon`, { method: "POST" });
  },
};
