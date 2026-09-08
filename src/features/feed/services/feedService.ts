import { apiFetch } from "@/services/api";
import type { Comment } from "@/types/recipe";
import type { FeedItem, FeedListParams, FeedPage, FeedTarget } from "@/types/feed";

/**
 * Gostos e comentários vivem em sítios diferentes conforme a natureza: um
 * cozinhado em `post_likes`/`post_comments`, uma receita nas tabelas que já
 * existiam. É a única diferença que o cliente precisa de conhecer.
 */
function basePath(target: FeedTarget): string {
  return target.kind === "cook" ? `/feed/cooks/${target.id}` : `/recipes/${target.id}`;
}

function buildQuery(params: FeedListParams): string {
  const search = new URLSearchParams();
  if (params.scope) search.set("scope", params.scope);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

type SocialCounts = Pick<FeedItem, "likesCount" | "commentsCount" | "likedByMe">;

async function socialPatch(target: FeedTarget, method: "POST" | "DELETE"): Promise<SocialCounts> {
  const data = await apiFetch<{
    item?: SocialCounts;
    recipe?: SocialCounts;
  }>(`${basePath(target)}/like`, { method });

  const source = data.item ?? data.recipe;
  if (!source) throw new Error("Resposta inesperada do servidor");

  // Só as contagens: o resto do item já está em cache e não mudou.
  return {
    likesCount: source.likesCount,
    commentsCount: source.commentsCount,
    likedByMe: source.likedByMe,
  };
}

export const feedService = {
  /** Uma página do feed: cozinhados e receitas na mesma lista. */
  list(params: FeedListParams = {}): Promise<FeedPage> {
    return apiFetch<FeedPage>(`/feed${buildQuery(params)}`);
  },

  /**
   * Gostar de um cozinhado devolve o item já actualizado; gostar de uma receita
   * devolve a receita, e o feed só precisa da parte social dela.
   */
  async like(target: FeedTarget): Promise<SocialCounts> {
    return socialPatch(target, "POST");
  },

  async unlike(target: FeedTarget): Promise<SocialCounts> {
    return socialPatch(target, "DELETE");
  },

  async comments(target: FeedTarget): Promise<Comment[]> {
    const data = await apiFetch<{ comments: Comment[] }>(`${basePath(target)}/comments`);
    return data.comments;
  },

  async addComment(target: FeedTarget, body: string): Promise<Comment> {
    const data = await apiFetch<{ comment: Comment }>(`${basePath(target)}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    return data.comment;
  },

  deleteComment(target: FeedTarget, commentId: string): Promise<void> {
    return apiFetch<void>(`${basePath(target)}/comments/${commentId}`, { method: "DELETE" });
  },
};
