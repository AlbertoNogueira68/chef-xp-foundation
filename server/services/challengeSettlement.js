import { podiumOf, rankChallenge } from "../domain/challengeRanking.js";
import { awardXp } from "../lib/xpLedger.js";

/**
 * O fim de um desafio: fechar o ranking e pagar o pódio.
 *
 * Um desafio tem uma data de fim, e essa data tem de significar alguma coisa
 * sem depender de alguém carregar num botão. Quem fecha os desafios é o
 * agendador (`lib/challengeScheduler.js`), que passa por aqui de tempos a
 * tempos; um moderador pode forçar o fecho de um desafio que já acabou, e o
 * resultado é exatamente o mesmo — esta função é a única que sabe fechar.
 *
 * Fechar é fazer três coisas de uma vez, ou nenhuma:
 *   · congelar o resultado em `challenge_results`;
 *   · pagar o XP do pódio pelo livro-razão;
 *   · marcar `settled_at`, que é o que impede a segunda vez.
 *
 * As três vão na mesma transação, e o `FOR UPDATE` com `settled_at IS NULL`
 * faz com que dois agendadores a correr ao mesmo tempo não paguem a dobrar:
 * o segundo encontra a linha já marcada e vai-se embora.
 */

/** Os gostos de cada submissão, com o fuso de quem a fez (para o XP diário). */
const SELECT_ENTRIES = `
  SELECT
    e.user_id,
    u.time_zone,
    (SELECT COUNT(*) FROM recipe_likes rl WHERE rl.recipe_id = e.recipe_id) AS likes
  FROM challenge_entries e
  JOIN users u ON u.id = e.user_id
  WHERE e.challenge_id = $1
`;

/**
 * Fecha um desafio, se ele já acabou e ainda não foi fechado.
 *
 * @returns {Promise<{ settled: boolean, reason?: string, results?: object[] }>}
 *   `settled: false` não é erro: é um desafio que ainda corre, que já foi
 *   fechado, ou que não existe.
 */
export async function settleChallenge(pool, challengeId, { now = new Date() } = {}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: challengeRows } = await client.query(
      `SELECT id, ends_at, first_place_xp, second_place_xp, third_place_xp
         FROM challenges
        WHERE id = $1 AND settled_at IS NULL AND ends_at <= $2
        FOR UPDATE`,
      [challengeId, now],
    );

    const challenge = challengeRows[0];
    if (!challenge) {
      await client.query("ROLLBACK");
      return { settled: false, reason: "not-due" };
    }

    const { rows: entries } = await client.query(SELECT_ENTRIES, [challengeId]);
    const ranked = rankChallenge(
      entries.map((row) => ({ userId: row.user_id, likes: row.likes })),
      podiumOf(challenge),
    );

    const timeZones = new Map(entries.map((row) => [row.user_id, row.time_zone ?? "UTC"]));

    for (const participante of ranked) {
      await client.query(
        `INSERT INTO challenge_results (challenge_id, user_id, place, likes, xp_awarded)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (challenge_id, user_id) DO NOTHING`,
        [challengeId, participante.userId, participante.place, participante.likes, participante.xp],
      );

      if (participante.xp <= 0) continue;

      /**
       * Fonte própria (`challenge_podium`) e não mais um evento de
       * `challenge`: o livro-razão é único por (utilizador, fonte,
       * referência), e a referência aqui é o mesmo id do desafio que já pagou
       * a participação. Com a mesma fonte, o prémio do 1.º lugar batia no XP
       * de ter entrado e desaparecia em silêncio.
       *
       * `awardXp` trata do resto — XP do dia, streak e nível — e é idempotente
       * pelo mesmo UNIQUE, por isso uma segunda passagem não paga a dobrar.
       */
      await awardXp(client, {
        userId: participante.userId,
        source: "challenge_podium",
        sourceRef: challengeId,
        amount: participante.xp,
        timeZone: timeZones.get(participante.userId) ?? "UTC",
        now,
      });
    }

    await client.query(`UPDATE challenges SET settled_at = $2 WHERE id = $1`, [challengeId, now]);
    await client.query("COMMIT");

    return { settled: true, results: ranked };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Fecha todos os desafios que já acabaram e ainda não foram fechados.
 *
 * Um de cada vez, em transações separadas: um desafio que rebente — um
 * utilizador apagado a meio, por exemplo — não pode levar consigo os outros
 * que estavam na mesma passagem.
 */
export async function settleDueChallenges(pool, { now = new Date(), limit = 50 } = {}) {
  const { rows } = await pool.query(
    `SELECT id FROM challenges
      WHERE settled_at IS NULL AND ends_at <= $1
      ORDER BY ends_at ASC
      LIMIT $2`,
    [now, limit],
  );

  const fechados = [];
  const falhados = [];

  for (const row of rows) {
    try {
      const resultado = await settleChallenge(pool, row.id, { now });
      if (resultado.settled) fechados.push(row.id);
    } catch (error) {
      falhados.push({ id: row.id, error });
    }
  }

  return { due: rows.length, settled: fechados, failed: falhados };
}
