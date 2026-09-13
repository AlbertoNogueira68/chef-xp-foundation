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

/**
 * Editar é o mesmo conjunto de campos, todos opcionais. `imageDataUrl` ausente
 * mantém a fotografia atual; `null` retira-a.
 */
export const recipeUpdateSchema = recipeCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Nada para atualizar" });

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

/**
 * Uma resposta já não é só texto: `order` manda a sequência de passos e
 * `estimate` manda um número. O servidor é que decide o que é válido para
 * cada tipo — aqui só se limita o tamanho.
 */
export const answerValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.array(z.string().max(200)).max(12),
]);

export const answerSubmitSchema = z.object({
  questionId: z.string().min(1).max(80),
  answer: answerValueSchema,
});

export const lessonCompleteSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: answerValueSchema,
      }),
    )
    .max(50)
    .default([]),
});

export const idParamSchema = z.object({ id: uuid });
export const lessonParamSchema = z.object({ id: z.string().min(1).max(80) });

/* ---------------------------------------------------------------- */
/* Missões                                                          */
/* ---------------------------------------------------------------- */

export const missionParamSchema = z.object({ id: z.string().min(1).max(80) });
export const runParamSchema = z.object({ runId: z.coerce.number().int().positive() });

export const stepMoveSchema = z.object({
  stepIndex: z.coerce.number().int().min(0).max(50),
});

export const checkpointSchema = z.object({
  stepIndex: z.coerce.number().int().min(0).max(50),
  imageDataUrl: z.string().min(1).max(6_000_000),
});

export const rescueSchema = z.object({
  stepIndex: z.coerce.number().int().min(0).max(50),
  kind: z.enum(["queimei", "cola", "falta", "pronto"]),
});

export const missionCompleteSchema = z.object({
  share: z.boolean().default(false),
  caption: z.string().trim().max(280).nullish(),
});

/* ---------------------------------------------------------------- */
/* Desafios                                                         */
/* ---------------------------------------------------------------- */

export const challengeEntrySchema = z.object({
  recipeId: uuid,
});

/* ---------------------------------------------------------------- */
/* Notificações                                                     */
/* ---------------------------------------------------------------- */

export const notificationListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

/** O id é BIGSERIAL, não UUID como no resto da API. */
export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/* ---------------------------------------------------------------- */
/* Rankings                                                         */
/* ---------------------------------------------------------------- */

export const leaderboardSchema = z.object({
  scope: z.enum(["global", "weekly"]).default("global"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/* ---------------------------------------------------------------- */
/* Conta                                                            */
/* ---------------------------------------------------------------- */

/**
 * Apagar a conta.
 *
 * `confirmUsername` é sempre exigido: escrever o próprio nome é o travão que
 * impede um clique distraído de apagar tudo. A password é exigida por cima
 * disso quando a conta tem uma — uma conta só de SSO não tem nenhuma para dar.
 */
export const accountDeleteSchema = z.object({
  confirmUsername: z.string().trim().toLowerCase().min(1, "Escreve o teu nome de utilizador"),
  password: z.string().max(200).optional(),
});

export const followListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
