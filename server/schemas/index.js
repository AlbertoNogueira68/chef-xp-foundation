import { z } from "zod";
import { firstFailedRule } from "../domain/passwordPolicy.js";
import { REPORT_REASONS, REPORT_SUBJECTS, ROLES } from "../domain/moderation.js";
import { DIETARY_TAGS } from "../domain/dietaryTags.js";

export const uuid = z.string().uuid("Invalid identifier");

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: z
    .string()
    .max(200)
    .superRefine((value, ctx) => {
      const falta = firstFailedRule(value);
      if (!falta) return;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: falta.message });
    }),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "The username must be at least 3 characters")
    .max(30, "At most 30 characters")
    .regex(/^[a-z0-9_.]+$/, "Lowercase letters, numbers, dot and underscore only"),
});

/**
 * Primeiro passo de criar conta: só o endereço. O nome e a password só são
 * pedidos do outro lado do link, com o email já confirmado.
 */
export const signupStartSchema = z.object({
  email: registerSchema.shape.email,
});

/**
 * Segundo passo: o token do email, o nome escolhido e a password (duas vezes,
 * conferidas no cliente — aqui chega uma só, porque o que o servidor guarda é
 * uma).
 */
export const signupCompleteSchema = z.object({
  token: z.string().trim().min(16, "Invalid token").max(200),
  username: registerSchema.shape.username,
  password: registerSchema.shape.password,
});

export const tokenQuerySchema = z.object({
  token: z.string().trim().min(16, "Invalid token").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: z.string().min(1, "Password required").max(200),
});

export const userPatchSchema = z
  .object({
    username: registerSchema.shape.username.optional(),
    photoUrl: z.string().max(500_000).nullable().optional(),
    timeZone: z.string().min(1).max(64).optional(),
    dailyXpGoal: z.coerce.number().int().min(10).max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update",
  });

export const recipeCreateSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(120),
  description: z.string().trim().min(10, "Tell us a bit more about the recipe").max(2000),
  ingredients: z.string().trim().min(5, "List at least a few ingredients").max(4000),
  cookTimeMin: z.coerce.number().int().min(5).max(600).default(30),
  difficulty: z.enum(["facil", "medio", "dificil"]).default("medio"),
  // Estimativa de quem publica, não um preço calculado — por isso é opcional.
  estimatedCostEur: z.coerce.number().min(0).max(999.99).nullish(),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)).max(DIETARY_TAGS.length).default([]),
  imageDataUrl: z.string().max(6_000_000).nullish(),
  /**
   * Publicar já dentro de um desafio.
   *
   * Participar num desafio é publicar uma receita nova — a mesma publicação
   * de sempre, com o desafio agarrado. Por isso o desafio entra aqui e não
   * numa rota à parte: era a única maneira de a receita e a participação
   * nascerem na mesma transação.
   */
  challengeId: uuid.nullish(),
});

/**
 * Editar é o mesmo conjunto de campos, todos opcionais. `imageDataUrl` ausente
 * mantém a fotografia atual; `null` retira-a.
 *
 * O desafio fica de fora: a submissão aconteceu no momento em que a receita
 * foi publicada, e mudá-la depois seria passar uma receita de um desafio para
 * outro a meio — retirar a participação é o caminho, e tem porta própria.
 */
export const recipeUpdateSchema = recipeCreateSchema
  .omit({ challengeId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

/**
 * `dietaryTags` chega na query como uma string separada por vírgulas
 * (`?dietaryTags=vegetariano,sem_gluten`), não como array — é assim que
 * `URLSearchParams` a manda. Filtrar exige *todas* as etiquetas escolhidas,
 * porque é assim que uma restrição alimentar funciona: alguém vegetariano e
 * sem glúten precisa das duas ao mesmo tempo, não de uma ou outra.
 */
const dietaryTagsQuery = z.preprocess(
  (value) => {
    if (typeof value !== "string" || value.length === 0) return undefined;
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  },
  z.array(z.enum(DIETARY_TAGS)).max(DIETARY_TAGS.length).optional(),
);

export const recipeListSchema = z.object({
  q: z.string().trim().max(80).optional(),
  scope: z.enum(["all", "following", "popular"]).default("all"),
  difficulty: z.enum(["facil", "medio", "dificil"]).optional(),
  maxTime: z.coerce.number().int().min(5).max(600).optional(),
  maxCost: z.coerce.number().min(0).max(999.99).optional(),
  dietaryTags: dietaryTagsQuery,
  authorId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  cursor: z.string().max(200).optional(),
});

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1, "Escreve alguma coisa").max(500, "At most 500 characters"),
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

/**
 * Criar um desafio (moderadores e administradores).
 *
 * Os quatro números são a mecânica inteira, e são de quem cria: quanto paga
 * participar, quantas submissões cabem a cada pessoa, quantos dias dura e o
 * que valem os três lugares do pódio. Os limites de cada um não são gosto
 * pessoal — são o que impede um desafio de três anos a pagar 100 000 XP de
 * tornar todo o resto da aplicação irrelevante.
 */
export const challengeCreateSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(120),
  description: z.string().trim().min(10, "Tell us a bit more about the challenge").max(2000),
  xpReward: z.coerce.number().int().min(0).max(1000).default(100),
  maxEntriesPerUser: z.coerce.number().int().min(1).max(10).default(1),
  durationDays: z.coerce.number().int().min(1).max(90).default(7),
  firstPlaceXp: z.coerce.number().int().min(0).max(5000).default(300),
  secondPlaceXp: z.coerce.number().int().min(0).max(5000).default(200),
  thirdPlaceXp: z.coerce.number().int().min(0).max(5000).default(100),
  imageDataUrl: z.string().max(6_000_000).nullish(),
});

/**
 * Editar. Tudo opcional, e o prazo passa a ser uma data em vez de dias: a
 * duração só faz sentido no momento em que o desafio nasce; depois disso o
 * que existe é um fim, e mexer nele é adiá-lo. O que se pode mesmo mudar com
 * gente lá dentro é decidido em `domain/challenges.js`, não aqui.
 */
export const challengeUpdateSchema = z
  .object({
    title: challengeCreateSchema.shape.title.optional(),
    description: challengeCreateSchema.shape.description.optional(),
    xpReward: challengeCreateSchema.shape.xpReward.optional(),
    maxEntriesPerUser: challengeCreateSchema.shape.maxEntriesPerUser.optional(),
    firstPlaceXp: challengeCreateSchema.shape.firstPlaceXp.optional(),
    secondPlaceXp: challengeCreateSchema.shape.secondPlaceXp.optional(),
    thirdPlaceXp: challengeCreateSchema.shape.thirdPlaceXp.optional(),
    endsAt: z.coerce.date().optional(),
    imageDataUrl: z.string().max(6_000_000).nullish(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

/** Uma submissão em particular, para a retirar sem levar as outras. */
export const challengeEntryParamsSchema = z.object({
  id: uuid,
  entryId: z.coerce.number().int().positive(),
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
  confirmUsername: z.string().trim().toLowerCase().min(1, "Type your username"),
  password: z.string().max(200).optional(),
});

export const followListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/* ---------------------------------------------------------------- */
/* Recuperação de password e verificação de email                   */
/* ---------------------------------------------------------------- */

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
});

/**
 * A password nova segue a mesma regra do registo, por reutilizar o mesmo
 * campo. Ter duas regras diferentes para a mesma coluna era deixar a porta
 * das traseiras mais fraca do que a da frente.
 */
export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16, "Invalid token").max(200),
  password: registerSchema.shape.password,
});

export const emailTokenSchema = z.object({
  token: z.string().trim().min(16, "Invalid token").max(200),
});

/* ---------------------------------------------------------------- */
/* Moderação                                                        */
/* ---------------------------------------------------------------- */

/**
 * Uma denúncia. Os motivos são os mesmos que o CHECK da migration 012 aceita —
 * a lista vem de `domain/moderation.js` para não haver duas versões dela.
 */
export const reportCreateSchema = z.object({
  subjectType: z.enum(REPORT_SUBJECTS),
  subjectId: uuid,
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500, "At most 500 characters").nullish(),
});

export const reportListSchema = z.object({
  status: z.enum(["open", "resolved", "dismissed", "all"]).default("open"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Fechar uma denúncia: apagar o conteúdo, ou arquivar sem lhe tocar. */
export const reportResolveSchema = z.object({
  action: z.enum(["remover", "arquivar"]),
});

/** Como as notificações, o id de uma denúncia é BIGSERIAL. */
export const reportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Apagar um comentário. Os dois identificadores vinham crus de `req.params`,
 * o que dava um erro de Postgres em vez de um 400 a quem escrevesse um id
 * malformado no URL.
 */
export const commentParamsSchema = z.object({
  id: uuid,
  commentId: uuid,
});

/* ---------------------------------------------------------------- */
/* Administração                                                    */
/* ---------------------------------------------------------------- */

/**
 * A lista de contas do painel. `role` filtra por papel — é assim que se
 * responde a "quem é que modera isto?" sem procurar nome a nome.
 */
export const adminUserListSchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(["user", "moderator", "admin", "staff", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/**
 * Mudar o papel de alguém. `admin` não está aqui de propósito: quem o valida
 * é `roleChangeRefusal`, que dá a razão em vez de um "dados inválidos" seco.
 */
export const roleChangeSchema = z.object({
  role: z.enum(ROLES),
});

/**
 * Apagar a conta de alguém: escreve-se o nome dela, como no perfil. Um clique
 * enganado na linha de cima não pode levar a conta de outra pessoa.
 */
export const adminAccountDeleteSchema = z.object({
  confirmUsername: z.string().trim().toLowerCase().min(1, "Type the account's name"),
});
