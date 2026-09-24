export type RecipeDifficulty = "facil" | "medio" | "dificil";

/** Mantido em sincronia à mão com `server/domain/dietaryTags.js`. */
export type DietaryTag =
  | "vegetariano"
  | "vegano"
  | "sem_gluten"
  | "sem_lactose"
  | "sem_frutos_secos"
  | "sem_ovo"
  | "sem_soja"
  | "sem_acucar"
  | "halal"
  | "kosher";

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
  /** Estimativa de quem publicou, não um preço calculado. `null` = sem estimativa. */
  estimatedCostEur: number | null;
  dietaryTags: DietaryTag[];
  imageUrl: string | null;
  likesCount: number;
  commentsCount: number;
  /** Se o utilizador autenticado já gostou. Vem do servidor, não do estado local. */
  likedByMe: boolean;
  createdAt: string;
  author: RecipeAuthor;
  /**
   * O desafio a que esta receita foi submetida, quando existe.
   *
   * Uma receita de desafio é uma receita como as outras — aparece no feed,
   * ganha gostos e comentários — e é este campo que lhe põe o selo em todo o
   * lado sem ninguém ter de ir perguntar ao desafio.
   */
  challenge: { id: string; title: string } | null;
}

export interface RecipeCreateInput {
  title: string;
  description: string;
  ingredients: string;
  cookTimeMin: number;
  difficulty: RecipeDifficulty;
  estimatedCostEur?: number | null;
  dietaryTags?: DietaryTag[];
  /** Data URL já redimensionado no cliente. */
  imageDataUrl?: string | null;
  /**
   * Publicar já dentro de um desafio: participar é cozinhar para ele, não
   * agarrar uma receita antiga. A receita e a participação nascem juntas, no
   * servidor, na mesma transação.
   */
  challengeId?: string | null;
}

/**
 * Editar aceita os mesmos campos, todos opcionais — menos o desafio: a
 * submissão aconteceu no momento em que a receita foi publicada.
 */
export type RecipeUpdateInput = Partial<Omit<RecipeCreateInput, "challengeId">>;

export type FeedScope = "all" | "following" | "popular";

export interface RecipeListParams {
  q?: string;
  scope?: FeedScope;
  difficulty?: RecipeDifficulty;
  maxTime?: number;
  maxCost?: number;
  dietaryTags?: DietaryTag[];
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
