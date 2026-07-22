import type { Challenge } from "@/types/challenge";
import type { Recipe, RecipeCreateInput } from "@/types/recipe";

const now = Date.now();
const ago = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString();
const ahead = (days: number) => new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

export interface Story {
  id: string;
  username: string;
  avatarUrl: string;
  imageUrl: string;
  viewed: boolean;
}

export interface TrendingTag {
  id: string;
  label: string;
  posts: number;
}

export interface SuggestedChef {
  id: string;
  username: string;
  avatarUrl: string;
  specialty: string;
  followers: number;
  level: number;
}

export interface ProfileStats {
  recipes: number;
  followers: number;
  following: number;
  streak: number;
  badges: string[];
  nextLevelXp: number;
}

export const DEMO_STORIES: Story[] = [
  {
    id: "s1",
    username: "mariacozinha",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=700&fit=crop",
    viewed: false,
  },
  {
    id: "s2",
    username: "joaoforno",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=700&fit=crop",
    viewed: false,
  },
  {
    id: "s3",
    username: "souschef",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=700&fit=crop",
    viewed: true,
  },
  {
    id: "s4",
    username: "chefdemo",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=700&fit=crop",
    viewed: true,
  },
  {
    id: "s5",
    username: "anacozinha",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop",
    imageUrl: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=700&fit=crop",
    viewed: false,
  },
];

export const DEMO_TRENDING: TrendingTag[] = [
  { id: "t1", label: "#mealprep", posts: 1240 },
  { id: "t2", label: "#vegano", posts: 890 },
  { id: "t3", label: "#sobremesas", posts: 2100 },
  { id: "t4", label: "#30minutos", posts: 756 },
  { id: "t5", label: "#portuguesa", posts: 543 },
];

export const DEMO_CHEFS: SuggestedChef[] = [
  {
    id: "33333333-3333-3333-3333-333333333333",
    username: "mariacozinha",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
    specialty: "Clássicos PT",
    followers: 2840,
    level: 4,
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    username: "joaoforno",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    specialty: "Padaria & brunch",
    followers: 1920,
    level: 2,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    username: "souschef",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
    specialty: "Saudável",
    followers: 3100,
    level: 2,
  },
];

export const DEMO_PROFILE_STATS: ProfileStats = {
  recipes: 12,
  followers: 348,
  following: 156,
  streak: 7,
  badges: ["Primeira receita", "Semana ativa", "Chef nível 3"],
  nextLevelXp: 500,
};

const FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=800&fit=crop",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=800&fit=crop",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=800&fit=crop",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=800&fit=crop",
  "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=800&fit=crop",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=800&fit=crop",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=800&fit=crop",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&h=800&fit=crop",
];

let mockRecipes: Recipe[] = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Bacalhau à Brás express",
    description:
      "Clássico português em versão rápida. Crocante, cremoso e perfeito para uma noite de semana.",
    ingredients: "bacalhau, cebola, ovos, batata palha, azeite",
    cookTimeMin: 35,
    difficulty: "medio",
    xpReward: 40,
    likesCount: 284,
    commentsCount: 42,
    savesCount: 89,
    tags: ["portuguesa", "rápido"],
    imageUrl: FOOD_IMAGES[0],
    createdAt: ago(2),
    author: {
      id: "33333333-3333-3333-3333-333333333333",
      username: "mariacozinha",
      level: 4,
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
    },
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    title: "Bowl de quinoa e legumes",
    description: "Almoço saudável com crocância e molho de iogurte e limão.",
    ingredients: "quinoa, abóbora, brócolos, grão-de-bico, iogurte",
    cookTimeMin: 40,
    difficulty: "facil",
    xpReward: 30,
    likesCount: 167,
    commentsCount: 18,
    savesCount: 54,
    tags: ["saudável", "mealprep"],
    imageUrl: FOOD_IMAGES[2],
    createdAt: ago(5),
    author: {
      id: "22222222-2222-2222-2222-222222222222",
      username: "souschef",
      level: 2,
      avatarUrl:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
    },
  },
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    title: "Pão de banana sem açúcar",
    description: "Doce natural da banana e canela. Perfeito para o pequeno-almoço.",
    ingredients: "bananas, ovos, farinha de aveia, canela, nozes",
    cookTimeMin: 55,
    difficulty: "facil",
    xpReward: 25,
    likesCount: 412,
    commentsCount: 67,
    savesCount: 201,
    tags: ["sobremesas", "fit"],
    imageUrl: FOOD_IMAGES[4],
    createdAt: ago(24),
    author: {
      id: "44444444-4444-4444-4444-444444444444",
      username: "joaoforno",
      level: 2,
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    },
  },
  {
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    title: "Risotto de cogumelos",
    description: "Cremoso, aromático e ideal para impressionar sem stress.",
    ingredients: "arroz arborio, cogumelos, caldo, vinho branco, parmesão",
    cookTimeMin: 45,
    difficulty: "dificil",
    xpReward: 60,
    likesCount: 128,
    commentsCount: 23,
    savesCount: 76,
    tags: ["italiana", "jantar"],
    imageUrl: FOOD_IMAGES[1],
    createdAt: ago(0.5),
    author: {
      id: "11111111-1111-1111-1111-111111111111",
      username: "chefdemo",
      level: 3,
      avatarUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    },
  },
  {
    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    title: "Salada de grão com atum",
    description: "Refeição fresca em 15 minutos. Ideal para meal prep.",
    ingredients: "grão, atum, tomate cherry, pepino, azeite",
    cookTimeMin: 15,
    difficulty: "facil",
    xpReward: 20,
    likesCount: 95,
    commentsCount: 11,
    savesCount: 34,
    tags: ["rápido", "proteína"],
    imageUrl: FOOD_IMAGES[3],
    createdAt: ago(72),
    author: {
      id: "33333333-3333-3333-3333-333333333333",
      username: "mariacozinha",
      level: 4,
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
    },
  },
  {
    id: "ffffffff-ffff-ffff-ffff-fffffffffffe",
    title: "Tacos de frango crocante",
    description: "Textura irresistível com molho de iogurte picante.",
    ingredients: "frango, tortillas, repolho, iogurte, lima",
    cookTimeMin: 25,
    difficulty: "medio",
    xpReward: 35,
    likesCount: 523,
    commentsCount: 89,
    savesCount: 142,
    tags: ["mexicana", "30minutos"],
    imageUrl: FOOD_IMAGES[6],
    createdAt: ago(8),
    author: {
      id: "22222222-2222-2222-2222-222222222222",
      username: "souschef",
      level: 2,
      avatarUrl:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
    },
  },
  {
    id: "99999999-9999-9999-9999-999999999998",
    title: "Brunch de ovos benedict",
    description: "Hollandaise cremosa e muffins tostados. Domingo perfeito.",
    ingredients: "ovos, muffins, bacon, manteiga, limão",
    cookTimeMin: 30,
    difficulty: "dificil",
    xpReward: 50,
    likesCount: 367,
    commentsCount: 45,
    savesCount: 98,
    tags: ["brunch", "ovos"],
    imageUrl: FOOD_IMAGES[7],
    createdAt: ago(12),
    author: {
      id: "44444444-4444-4444-4444-444444444444",
      username: "joaoforno",
      level: 2,
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    },
  },
  {
    id: "88888888-8888-8888-8888-888888888887",
    title: "Salmão grelhado com espargos",
    description: "Jantar leve em 20 minutos. Rico em ómega-3.",
    ingredients: "salmão, espargos, limão, alho, azeite",
    cookTimeMin: 20,
    difficulty: "facil",
    xpReward: 30,
    likesCount: 198,
    commentsCount: 31,
    savesCount: 67,
    tags: ["saudável", "peixe"],
    imageUrl: FOOD_IMAGES[5],
    createdAt: ago(18),
    author: {
      id: "11111111-1111-1111-1111-111111111111",
      username: "chefdemo",
      level: 3,
      avatarUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    },
  },
];

let mockChallenges: Challenge[] = [
  {
    id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    title: "Semana sem frituras",
    description: "Publica 3 refeições saudáveis sem fritar. Forno, vapor e grelhador contam.",
    xpReward: 150,
    endsAt: ahead(5),
    createdAt: ago(48),
    active: true,
    participants: 1240,
    progress: 33,
    imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=500&fit=crop",
    gradient: "from-emerald-600/80 to-teal-900/90",
  },
  {
    id: "99999999-9999-9999-9999-999999999999",
    title: "Clássicos portugueses",
    description: "Reinventa um prato típico com um twist moderno e partilha no feed.",
    xpReward: 200,
    endsAt: ahead(9),
    createdAt: ago(24),
    active: true,
    participants: 890,
    progress: 0,
    imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=500&fit=crop",
    gradient: "from-amber-600/80 to-orange-900/90",
  },
  {
    id: "88888888-8888-8888-8888-888888888888",
    title: "Desafio 20 minutos",
    description: "Cozinha uma receita completa em 20 min ou menos. Cronometra!",
    xpReward: 100,
    endsAt: ahead(3),
    createdAt: ago(6),
    active: true,
    participants: 2100,
    progress: 66,
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop",
    gradient: "from-rose-600/80 to-purple-900/90",
  },
];

export const delay = (ms = 350) => new Promise<void>((r) => setTimeout(r, ms));

export function getDemoRecipes(q?: string): Recipe[] {
  const query = q?.trim().toLowerCase();
  if (!query) return [...mockRecipes];
  return mockRecipes.filter(
    (r) =>
      r.title.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query) ||
      r.author.username.toLowerCase().includes(query) ||
      r.tags?.some((t) => t.includes(query)),
  );
}

export function likeDemoRecipe(id: string): Recipe | undefined {
  const recipe = mockRecipes.find((r) => r.id === id);
  if (recipe) recipe.likesCount += 1;
  return recipe ? { ...recipe } : undefined;
}

export function createDemoRecipe(
  input: RecipeCreateInput,
  author = {
    id: "11111111-1111-1111-1111-111111111111",
    username: "chefdemo",
    level: 3,
    avatarUrl:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
  },
): Recipe {
  const recipe: Recipe = {
    id: crypto.randomUUID(),
    ...input,
    xpReward: 25,
    likesCount: 0,
    commentsCount: 0,
    savesCount: 0,
    tags: ["novo"],
    imageUrl: FOOD_IMAGES[Math.floor(Math.random() * FOOD_IMAGES.length)],
    createdAt: new Date().toISOString(),
    author,
  };
  mockRecipes = [recipe, ...mockRecipes];
  return recipe;
}

export function getDemoChallenges(): Challenge[] {
  return [...mockChallenges];
}
