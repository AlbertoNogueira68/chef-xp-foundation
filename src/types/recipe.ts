export type RecipeDifficulty = "facil" | "medio" | "dificil";

export interface RecipeAuthor {
  id: string;
  username: string;
  level: number;
  photoUrl: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: string;
  cookTimeMin: number;
  difficulty: RecipeDifficulty;
  xpReward: number;
  imageUrl: string | null;
  likesCount: number;
  commentsCount: number;
  /** Se o utilizador autenticado já gostou. Vem do servidor, não do estado local. */
  likedByMe: boolean;
  createdAt: string;
  author: RecipeAuthor;
}

export interface RecipeCreateInput {
  title: string;
  description: string;
  ingredients: string;
  cookTimeMin: number;
  difficulty: RecipeDifficulty;
  /** Data URL já redimensionado no cliente. */
  imageDataUrl?: string | null;
}

export type FeedScope = "all" | "following" | "popular";

export interface RecipeListParams {
  q?: string;
  scope?: FeedScope;
  difficulty?: RecipeDifficulty;
  maxTime?: number;
  authorId?: string;
  limit?: number;
  cursor?: string | null;
}

export interface RecipePage {
  recipes: Recipe[];
  nextCursor: string | null;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    photoUrl: string | null;
    level: number;
  };
}
