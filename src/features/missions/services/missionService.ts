import { apiFetch } from "@/services/api";
import type { MissionCompletion, MissionRunState, RescueKind } from "@/types/learning";

export const missionService = {
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
