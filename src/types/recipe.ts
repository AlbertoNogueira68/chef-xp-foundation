export type RecipeDifficulty = "facil" | "medio" | "dificil";

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: string;
  cookTimeMin: number;
  difficulty: RecipeDifficulty;
  xpReward: number;
  likesCount: number;
  commentsCount?: number;
  savesCount?: number;
  tags?: string[];
  imageUrl?: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    level: number;
    avatarUrl?: string;
  };
}

export interface RecipeCreateInput {
  title: string;
  description: string;
  ingredients: string;
  cookTimeMin: number;
  difficulty: RecipeDifficulty;
}
