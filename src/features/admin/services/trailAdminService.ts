import { apiFetch, type ApiError } from "@/services/api";

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
  /** Escrito pelo painel. Os outros vêm de ficheiro e não se editam por aqui. */
  admin_authored: boolean;
  /** O currículo carregou. Um trilho sem isto não se publica. */
  loaded: boolean;
}

export interface TrailDraft {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  difficulty: TrailDifficulty;
  orderIndex?: number;
  curriculum?: unknown;
}

/**
 * O servidor recusa um currículo inválido com a lista inteira de problemas.
 * Guardá-la é o que permite ao painel dizer *o que* está mal em vez de
 * "pedido inválido" — é a diferença entre corrigir e adivinhar.
 */
export class TrailValidationError extends Error {
  readonly errors: string[];

  constructor(message: string, errors: string[]) {
    super(message);
    this.name = "TrailValidationError";
    this.errors = errors;
  }
}

async function comValidacao<T>(pedido: Promise<T>): Promise<T> {
  try {
    return await pedido;
  } catch (error) {
    const detalhes = (error as ApiError).details;
    if (Array.isArray(detalhes) && detalhes.length > 0) {
      throw new TrailValidationError((error as Error).message, detalhes as string[]);
    }
    throw error;
  }
}

export const trailAdminService = {
  async list(): Promise<AdminTrail[]> {
    const data = await apiFetch<{ trails: AdminTrail[] }>("/admin/trails");
    return data.trails;
  },

  async get(id: string): Promise<{ trail: AdminTrail; curriculum: unknown; loaded: boolean }> {
    return apiFetch(`/admin/trails/${id}`);
  },

  async create(draft: TrailDraft): Promise<AdminTrail> {
    const data = await comValidacao(
      apiFetch<{ trail: AdminTrail }>("/admin/trails", {
        method: "POST",
        body: JSON.stringify(draft),
      }),
    );
    return data.trail;
  },

  async update(id: string, patch: Partial<TrailDraft>): Promise<AdminTrail> {
    const data = await comValidacao(
      apiFetch<{ trail: AdminTrail }>(`/admin/trails/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    );
    return data.trail;
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

  async remove(id: string): Promise<string> {
    const data = await apiFetch<{ deleted: string }>(`/admin/trails/${id}`, { method: "DELETE" });
    return data.deleted;
  },
};
