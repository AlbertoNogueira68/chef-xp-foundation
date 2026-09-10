import { apiFetch } from "@/services/api";
import type { PlanInput, PlanState } from "@/types/plan";

export const planService = {
  get(): Promise<PlanState> {
    return apiFetch<PlanState>("/plan");
  },

  save(input: PlanInput): Promise<PlanState> {
    return apiFetch<PlanState>("/plan", { method: "PUT", body: JSON.stringify(input) });
  },

  /** Desistir. O que já aconteceu fica no historial; o plano é que desaparece. */
  remove(): Promise<PlanState> {
    return apiFetch<PlanState>("/plan", { method: "DELETE" });
  },
};
