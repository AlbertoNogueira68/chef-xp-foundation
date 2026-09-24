import { Router } from "express";
import { getPool, query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { notBlockedSql } from "../lib/blocks.js";
import {
  challengeCreateSchema,
  challengeEntryParamsSchema,
  challengeUpdateSchema,
  idParamSchema,
} from "../schemas/index.js";
import { toChallenge, toChallengeEntry, toChallengeResult } from "../lib/mappers.js";
import {
  canLeaveChallenge,
  challengeDeletionRefusal,
  challengeEditRefusal,
} from "../domain/challenges.js";
import { requireModerator } from "../lib/moderation.js";
import { resolveImageInput } from "../lib/imageStore.js";
import { settleChallenge } from "../services/challengeSettlement.js";

const router = Router();

router.use(requireAuth);

/**
 * `$1` é o utilizador autenticado: traz as contagens e quantas submissões ele
 * já tem, para o cartão não ter de fazer um segundo pedido só para saber se o
 * botão diz "Participar" ou "Já participaste".
 */
const SELECT_CHALLENGE = `
  SELECT
    c.id, c.title, c.description, c.xp_reward, c.image_url,
    c.starts_at, c.ends_at, c.created_at, c.created_by, c.settled_at,
    c.max_entries_per_user, c.first_place_xp, c.second_place_xp, c.third_place_xp,
    autor.username AS created_by_username,
    (SELECT COUNT(*) FROM challenge_entries e WHERE e.challenge_id = c.id)           AS entries_count,
    (SELECT COUNT(DISTINCT e.user_id) FROM challenge_entries e
      WHERE e.challenge_id = c.id)                                                   AS participants_count,
    (SELECT COUNT(*) FROM challenge_entries e
      WHERE e.challenge_id = c.id AND e.user_id = $1)                                AS my_entries_count
  FROM challenges c
  LEFT JOIN users autor ON autor.id = c.created_by
`;

/**
 * As participações de um desafio, já com a receita e o autor.
 *
 * Ordenadas por gostos, não por data: um desafio com um vencedor precisa de
 * uma ordem que signifique alguma coisa. O desempate é a submissão mais
 * antiga — quem chegou primeiro ao mesmo resultado fica à frente.
 */
const SELECT_ENTRIES = `
  SELECT
    e.id AS entry_id, e.created_at AS entered_at,
    r.id, r.author_id, r.title, r.description, r.ingredients,
    r.cook_time_min, r.difficulty, r.xp_reward, r.image_url, r.created_at,
    u.username  AS author_username,
    u.level     AS author_level,
    u.photo_url AS author_photo,
    (SELECT COUNT(*) FROM recipe_likes rl WHERE rl.recipe_id = r.id) AS likes_count,
    (SELECT COUNT(*) FROM comments cm     WHERE cm.recipe_id = r.id) AS comments_count,
    EXISTS (
      SELECT 1 FROM recipe_likes rl WHERE rl.recipe_id = r.id AND rl.user_id = $1
    ) AS liked_by_me,
    c.id    AS challenge_id,
    c.title AS challenge_title
  FROM challenge_entries e
  JOIN recipes    r ON r.id = e.recipe_id
  JOIN users      u ON u.id = r.author_id
  JOIN challenges c ON c.id = e.challenge_id
  WHERE e.challenge_id = $2
    AND ${notBlockedSql("$1", "r.author_id")}
  ORDER BY likes_count DESC, e.created_at ASC
  LIMIT 100
`;

/** O pódio congelado, do primeiro lugar para baixo. */
const SELECT_RESULTS = `
  SELECT cr.user_id, cr.place, cr.likes, cr.xp_awarded,
         u.username, u.photo_url, u.level
    FROM challenge_results cr
    JOIN users u ON u.id = cr.user_id
   WHERE cr.challenge_id = $1
   ORDER BY cr.place ASC, cr.likes DESC
   LIMIT 100
`;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `${SELECT_CHALLENGE}
        ORDER BY (c.ends_at > now()) DESC, c.ends_at ASC
        LIMIT 50`,
      [req.user.id],
    );
    res.json({ challenges: rows.map(toChallenge) });
  }),
);

router.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT_CHALLENGE} WHERE c.id = $2`, [
      req.user.id,
      req.valid.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Challenge not found" });

    const [{ rows: entries }, { rows: results }] = await Promise.all([
      query(SELECT_ENTRIES, [req.user.id, req.valid.params.id]),
      // Só há pódio depois do desafio ser liquidado — antes disso a tabela
      // está vazia e a consulta custa um índice.
      rows[0].settled_at ? query(SELECT_RESULTS, [req.valid.params.id]) : { rows: [] },
    ]);

    res.json({
      challenge: toChallenge(rows[0]),
      entries: entries.map(toChallengeEntry),
      results: results.map(toChallengeResult),
    });
  }),
);

/* ---------------------------------------------------------------- *
 * Criar e gerir (moderadores e administradores)
 * ---------------------------------------------------------------- */

/**
 * Criar um desafio.
 *
 * Moderadores e não só administradores: um desafio é conteúdo da comunidade,
 * da mesma família do que o moderador já trata todos os dias, e fazer
 * depender cada desafio novo da meia dúzia de administradores era garantir
 * que quase nenhum nascia. O que o moderador não pode continua a ser o que a
 * escada em `domain/moderation.js` diz — papéis e contas.
 *
 * A duração chega em dias e sai como duas datas: quem cria pensa em "uma
 * semana", e a base de dados precisa de um princípio e de um fim.
 */
router.post(
  "/",
  requireModerator,
  validate({ body: challengeCreateSchema }),
  asyncHandler(async (req, res) => {
    const body = req.valid.body;

    // A imagem é gravada fora da transação: I/O de disco não pertence a uma
    // transação aberta. É o mesmo que a publicação de receitas faz.
    const imageUrl = await resolveImageInput(body.imageDataUrl ?? null);

    const { rows } = await query(
      `INSERT INTO challenges
         (title, description, xp_reward, image_url, created_by,
          starts_at, ends_at, max_entries_per_user,
          first_place_xp, second_place_xp, third_place_xp)
       VALUES ($1, $2, $3, $4, $5,
               now(), now() + ($6 || ' days')::interval, $7,
               $8, $9, $10)
       RETURNING id`,
      [
        body.title,
        body.description,
        body.xpReward,
        imageUrl,
        req.user.id,
        String(body.durationDays),
        body.maxEntriesPerUser,
        body.firstPlaceXp,
        body.secondPlaceXp,
        body.thirdPlaceXp,
      ],
    );

    const { rows: criado } = await query(`${SELECT_CHALLENGE} WHERE c.id = $2`, [
      req.user.id,
      rows[0].id,
    ]);
    res.status(201).json({ challenge: toChallenge(criado[0]) });
  }),
);

/** Os campos editáveis, e a coluna de cada um. */
const EDITABLE_COLUMNS = {
  title: "title",
  description: "description",
  xpReward: "xp_reward",
  maxEntriesPerUser: "max_entries_per_user",
  firstPlaceXp: "first_place_xp",
  secondPlaceXp: "second_place_xp",
  thirdPlaceXp: "third_place_xp",
  endsAt: "ends_at",
};

/**
 * Editar um desafio. O que se pode mudar depende de já haver gente lá dentro
 * — a regra está em `domain/challenges.js`, aqui só se obedece.
 */
router.patch(
  "/:id",
  requireModerator,
  validate({ params: idParamSchema, body: challengeUpdateSchema }),
  asyncHandler(async (req, res) => {
    const challengeId = req.valid.params.id;
    const changes = req.valid.body;

    const { rows: atual } = await query(
      `SELECT c.ends_at, c.settled_at,
              EXISTS (SELECT 1 FROM challenge_entries e WHERE e.challenge_id = c.id) AS has_entries
         FROM challenges c WHERE c.id = $1`,
      [challengeId],
    );
    if (!atual[0]) return res.status(404).json({ error: "Challenge not found" });

    const recusa = challengeEditRefusal({
      settled: Boolean(atual[0].settled_at),
      hasEntries: atual[0].has_entries,
      changes,
      endsAt: atual[0].ends_at,
    });
    if (recusa) return res.status(409).json({ error: recusa });

    const sets = [];
    const values = [challengeId];

    for (const [campo, coluna] of Object.entries(EDITABLE_COLUMNS)) {
      if (changes[campo] === undefined) continue;
      values.push(changes[campo]);
      sets.push(`${coluna} = $${values.length}`);
    }

    if (changes.imageDataUrl !== undefined) {
      values.push(
        changes.imageDataUrl === null ? null : await resolveImageInput(changes.imageDataUrl),
      );
      sets.push(`image_url = $${values.length}`);
    }

    if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });

    await query(`UPDATE challenges SET ${sets.join(", ")} WHERE id = $1`, values);

    const { rows } = await query(`${SELECT_CHALLENGE} WHERE c.id = $2`, [req.user.id, challengeId]);
    res.json({ challenge: toChallenge(rows[0]) });
  }),
);

/** Apagar um desafio, enquanto ele ainda não é de ninguém. */
router.delete(
  "/:id",
  requireModerator,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.settled_at,
              EXISTS (SELECT 1 FROM challenge_entries e WHERE e.challenge_id = c.id) AS has_entries
         FROM challenges c WHERE c.id = $1`,
      [req.valid.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Challenge not found" });

    const recusa = challengeDeletionRefusal({
      settled: Boolean(rows[0].settled_at),
      hasEntries: rows[0].has_entries,
    });
    if (recusa) return res.status(409).json({ error: recusa });

    await query(`DELETE FROM challenges WHERE id = $1`, [req.valid.params.id]);
    res.status(204).end();
  }),
);

/**
 * Fechar um desafio já terminado, sem esperar pelo agendador.
 *
 * O agendador (`lib/challengeScheduler.js`) passa de cinco em cinco minutos e
 * faz exatamente isto. O botão existe para quem não quer esperar por essa
 * passagem, e não é um atalho: um desafio que ainda corre não fecha aqui —
 * `settleChallenge` recusa-o, porque encurtar o prazo é outra ação, que tem o
 * seu sítio na edição.
 */
router.post(
  "/:id/settle",
  requireModerator,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existe = await query(`SELECT 1 FROM challenges WHERE id = $1`, [req.valid.params.id]);
    if (existe.rowCount === 0) return res.status(404).json({ error: "Challenge not found" });

    const resultado = await settleChallenge(getPool(), req.valid.params.id);
    if (!resultado.settled) {
      return res
        .status(409)
        .json({ error: "This challenge hasn't ended yet, or is already closed" });
    }

    const { rows } = await query(`${SELECT_CHALLENGE} WHERE c.id = $2`, [
      req.user.id,
      req.valid.params.id,
    ]);
    const { rows: results } = await query(SELECT_RESULTS, [req.valid.params.id]);

    res.json({ challenge: toChallenge(rows[0]), results: results.map(toChallengeResult) });
  }),
);

/* ---------------------------------------------------------------- *
 * Participação
 * ---------------------------------------------------------------- */

/**
 * Participar mudou de sítio: é `POST /api/recipes` com `challengeId`.
 *
 * Havia aqui uma rota que agarrava uma receita já publicada a um desafio. Foi
 * removida quando participar passou a ser cozinhar para o desafio: com ela, a
 * mesma ação tinha duas portas com regras subtilmente diferentes, e a receita
 * e a participação nasciam em transações separadas. O que fica deste lado é o
 * contrário — retirar.
 */

/**
 * Retirar submissões enquanto o desafio corre.
 *
 * Com `:entryId` retira-se uma; sem ele, todas as que a pessoa tem neste
 * desafio. As duas portas existem porque um desafio de três fotos precisa de
 * poder trocar uma sem desistir do desafio inteiro.
 *
 * O evento de XP fica no livro-razão de propósito: o ponto já foi ganho e o
 * livro-razão regista o que aconteceu, não o que é verdade agora. O efeito
 * lateral é bom — voltar a entrar não volta a pagar.
 */
async function withdraw(req, res, entryId) {
  const challengeId = req.valid.params.id;

  const { rows: challengeRows } = await query(`SELECT ends_at FROM challenges WHERE id = $1`, [
    challengeId,
  ]);
  if (!challengeRows[0]) return res.status(404).json({ error: "Challenge not found" });

  const verdict = canLeaveChallenge({ endsAt: challengeRows[0].ends_at });
  if (!verdict.ok) return res.status(409).json({ error: verdict.message });

  const removed = entryId
    ? await query(
        `DELETE FROM challenge_entries WHERE challenge_id = $1 AND user_id = $2 AND id = $3`,
        [challengeId, req.user.id, entryId],
      )
    : await query(`DELETE FROM challenge_entries WHERE challenge_id = $1 AND user_id = $2`, [
        challengeId,
        req.user.id,
      ]);

  if (removed.rowCount === 0) {
    return res.status(404).json({ error: "You're not entered in this challenge" });
  }

  const { rows } = await query(`${SELECT_CHALLENGE} WHERE c.id = $2`, [req.user.id, challengeId]);
  res.json({ challenge: toChallenge(rows[0]) });
}

router.delete(
  "/:id/entries/:entryId",
  validate({ params: challengeEntryParamsSchema }),
  asyncHandler((req, res) => withdraw(req, res, req.valid.params.entryId)),
);

router.delete(
  "/:id/entries",
  validate({ params: idParamSchema }),
  asyncHandler((req, res) => withdraw(req, res, null)),
);

export default router;
