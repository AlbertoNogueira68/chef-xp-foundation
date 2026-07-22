import type { Recipe, RecipeCreateInput } from "@/types/recipe";
import {
  createDemoRecipe,
  delay,
  getDemoRecipes,
  likeDemoRecipe,
} from "@/constants/demo";

export const recipeService = {
  async list(q?: string): Promise<Recipe[]> {
    await delay();
    return getDemoRecipes(q);
  },

  async create(input: RecipeCreateInput): Promise<Recipe> {
    await delay(500);
    return createDemoRecipe(input);
  },

  async like(id: string): Promise<Recipe> {
    await delay(200);
    const recipe = likeDemoRecipe(id);
    if (!recipe) throw new Error("Receita não encontrada");
    return recipe;
  },
};
