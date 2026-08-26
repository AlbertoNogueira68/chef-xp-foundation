import { apiFetch } from "@/services/api";
import type {
  Comment,
  Recipe,
  RecipeCreateInput,
  RecipeListParams,
  RecipePage,
} from "@/types/recipe";

function buildQuery(params: RecipeListParams): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.scope) search.set("scope", params.scope);
  if (params.difficulty) search.set("difficulty", params.difficulty);
  if (params.maxTime) search.set("maxTime", String(params.maxTime));
  if (params.authorId) search.set("authorId", params.authorId);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const recipeService = {
  /** Uma página do feed. A paginação é por cursor, não por offset. */
  list(params: RecipeListParams = {}): Promise<RecipePage> {
    return apiFetch<RecipePage>(`/recipes${buildQuery(params)}`);
  },

  async getById(id: string): Promise<Recipe> {
    const data = await apiFetch<{ recipe: Recipe }>(`/recipes/${id}`);
    return data.recipe;
  },

  async create(input: RecipeCreateInput): Promise<{ recipe: Recipe; xpEarned: number }> {
    const data = await apiFetch<{
      recipe: Recipe;
      xp: { earned: number; total: number; level: number };
    }>("/recipes", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { recipe: data.recipe, xpEarned: data.xp?.earned ?? 0 };
  },

  async like(id: string): Promise<Recipe> {
    const data = await apiFetch<{ recipe: Recipe }>(`/recipes/${id}/like`, { method: "POST" });
    return data.recipe;
  },

  async unlike(id: string): Promise<Recipe> {
    const data = await apiFetch<{ recipe: Recipe }>(`/recipes/${id}/like`, { method: "DELETE" });
    return data.recipe;
  },

  async comments(id: string): Promise<Comment[]> {
    const data = await apiFetch<{ comments: Comment[] }>(`/recipes/${id}/comments`);
    return data.comments;
  },

  async addComment(id: string, body: string): Promise<Comment> {
    const data = await apiFetch<{ comment: Comment }>(`/recipes/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    return data.comment;
  },

  deleteComment(recipeId: string, commentId: string): Promise<void> {
    return apiFetch<void>(`/recipes/${recipeId}/comments/${commentId}`, { method: "DELETE" });
  },
};
