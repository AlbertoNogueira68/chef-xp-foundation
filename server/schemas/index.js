import { z } from "zod";

export const uuid = z.string().uuid("Identificador inválido");

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "A password tem de ter pelo menos 8 caracteres").max(200),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "O nome de utilizador tem de ter pelo menos 3 caracteres")
    .max(30, "Máximo 30 caracteres")
    .regex(/^[a-z0-9_.]+$/, "Só letras minúsculas, números, ponto e underscore"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "Password obrigatória").max(200),
});

export const userPatchSchema = z
  .object({
    username: registerSchema.shape.username.optional(),
    photoUrl: z.string().max(500_000).nullable().optional(),
    timeZone: z.string().min(1).max(64).optional(),
    dailyXpGoal: z.coerce.number().int().min(10).max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nada para atualizar",
  });

export const recipeCreateSchema = z.object({
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(120),
  description: z.string().trim().min(10, "Conta um pouco mais sobre a receita").max(2000),
  ingredients: z.string().trim().min(5, "Lista pelo menos alguns ingredientes").max(4000),
  cookTimeMin: z.coerce.number().int().min(5).max(600).default(30),
  difficulty: z.enum(["facil", "medio", "dificil"]).default("medio"),
  imageDataUrl: z.string().max(6_000_000).nullish(),
});

export const recipeListSchema = z.object({
  q: z.string().trim().max(80).optional(),
  scope: z.enum(["all", "following", "popular"]).default("all"),
  difficulty: z.enum(["facil", "medio", "dificil"]).optional(),
  maxTime: z.coerce.number().int().min(5).max(600).optional(),
  authorId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  cursor: z.string().max(200).optional(),
});

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1, "Escreve alguma coisa").max(500, "Máximo 500 caracteres"),
});

export const lessonCompleteSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().max(500),
      }),
    )
    .max(50)
    .default([]),
});

export const idParamSchema = z.object({ id: uuid });
export const lessonParamSchema = z.object({ id: z.string().min(1).max(80) });
