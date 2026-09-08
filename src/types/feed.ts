import type { FeedScope, RecipeDifficulty } from "./recipe";

export type { FeedScope };

/**
 * O feed tem duas naturezas com o mesmo peso: um cozinhado — uma missão
 * terminada e partilhada — e uma receita publicada.
 */
export type FeedKind = "cook" | "recipe";

export interface FeedAuthor {
  id: string;
  username: string;
  level: number;
  photoUrl: string | null;
}

interface FeedItemBase {
  /**
   * Única no conjunto. Os posts têm id BIGINT e as receitas UUID: sem o
   * prefixo da natureza, um post 7 e uma receita 7 seriam a mesma linha para
   * a cache.
   */
  key: string;
  id: string;
  imageUrl: string | null;
  xpReward: number;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  /** Se o utilizador autenticado já gostou. Vem do servidor, não do estado local. */
  likedByMe: boolean;
  author: FeedAuthor;
}

export interface CookFeedItem extends FeedItemBase {
  kind: "cook";
  runId: number | null;
  missionId: string;
  missionTitle: string;
  dishName: string;
  imageUrl: string;
  caption: string | null;
  /** O nível de quem publicou, à data. É o que mostra o caminho e não só o prato. */
  levelAt: number;
  minutes: number;
}

export interface RecipeFeedItem extends FeedItemBase {
  kind: "recipe";
  title: string;
  description: string;
  ingredients: string;
  cookTimeMin: number;
  difficulty: RecipeDifficulty;
}

export type FeedItem = CookFeedItem | RecipeFeedItem;

/** O par que identifica onde vive um gosto ou um comentário. */
export interface FeedTarget {
  kind: FeedKind;
  id: string;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface FeedListParams {
  scope?: FeedScope;
  limit?: number;
  cursor?: string | null;
}
