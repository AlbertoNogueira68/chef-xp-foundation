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

/* ---------------------------------------------------------------- */
/* Confirmação de conta e recuperação de password                   */
/* ---------------------------------------------------------------- */

const codeField = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, "O código tem seis dígitos");

/** Reaproveita as regras da password do registo — é a mesma password. */
const newPasswordField = registerSchema.shape.password;

export const emailOnlySchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

export const verifyCodeSchema = z.object({
  code: codeField,
});

export const passwordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  code: codeField,
  password: newPasswordField,
});

/**
 * Mudar a password estando autenticado.
 *
 * `currentPassword` é opcional porque uma conta criada por SSO não tem
 * nenhuma: quem entra com a Google define a primeira sem ter de provar uma que
 * nunca existiu. Para quem já tem password, a rota exige-a — e isso é
 * verificado no servidor, não aqui.
 */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200).nullish(),
  password: newPasswordField,
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

/* ---------------------------------------------------------------- */
/* Feed                                                             */
/* ---------------------------------------------------------------- */

export const feedListSchema = z.object({
  scope: z.enum(["all", "following", "popular"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  cursor: z.string().max(200).optional(),
});

/* ---------------------------------------------------------------- */
/* O compromisso                                                    */
/* ---------------------------------------------------------------- */

/**
 * Dias em ISO — 1 = segunda … 7 = domingo. Lista vazia é o modo "n vezes,
 * quando calhar", e aí é `targetWeek` que manda.
 */
export const planUpsertSchema = z.object({
  weekdays: z.array(z.coerce.number().int().min(1).max(7)).max(7).default([]),
  targetWeek: z.coerce.number().int().min(1).max(7).default(2),
});

/** Os posts têm id BIGINT — nunca UUID como as receitas. */
export const postParamSchema = z.object({
  postId: z.coerce.number().int().positive(),
});

export const postCommentParamSchema = postParamSchema.extend({
  commentId: uuid,
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

/**
 * O cliente só pode registar o que só ele sabe: que um temporizador arrancou e
 * que um comando de voz foi entendido.
 *
 * `rescue`, `back` e `abandon` continuam a ser escritos pelo servidor a partir
 * das ações verdadeiras. Deixar o cliente declará-los era deixar forjar
 * exatamente os dados em que a análise assenta.
 */
export const missionEventSchema = z.object({
  kind: z.enum(["timer", "voice"]),
  stepIndex: z.coerce.number().int().min(0).max(50),
  detail: z.string().trim().max(60).nullish(),
});

export const missionCompleteSchema = z.object({
  share: z.boolean().default(false),
  caption: z.string().trim().max(280).nullish(),
});
