import {
  computeStreak,
  dayInTimeZone,
  levelForXp,
  streakBonusFor,
} from "../domain/xp.js";

/**
 * Recalcula users.xp a partir do livro-razão e ajusta o nível.
 * O XP deixa de ser um contador que alguém incrementa à mão: é sempre a soma
 * de eventos, portanto é auditável e reconstruível.
 */
export async function recomputeUserXp(client, userId) {
  const { rows } = await client.query(
    `UPDATE users u
        SET xp = COALESCE((SELECT SUM(amount) FROM xp_events e WHERE e.user_id = u.id), 0)
      WHERE u.id = $1
      RETURNING xp`,
    [userId],
  );

  const xp = Number(rows[0]?.xp ?? 0);
  const level = levelForXp(xp);
  await client.query(`UPDATE users SET level = $2 WHERE id = $1 AND level <> $2`, [userId, level]);
  return { xp, level };
}

/**
 * Atribui XP de forma idempotente.
 * O UNIQUE (user_id, source, source_ref) faz o trabalho: repetir o pedido
 * devolve `awarded: false` em vez de somar outra vez.
 */
export async function awardXp(
  client,
  { userId, source, sourceRef = "", amount, timeZone = "UTC", now = new Date() },
) {
  const value = Math.max(0, Math.floor(Number(amount) || 0));

  const inserted = await client.query(
    `INSERT INTO xp_events (user_id, source, source_ref, amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, source, source_ref) DO NOTHING
     RETURNING id`,
    [userId, source, sourceRef, value],
  );

  const awarded = inserted.rowCount > 0;

  if (awarded && value > 0) {
    const day = dayInTimeZone(now, timeZone);
    await client.query(
      `INSERT INTO daily_activity (user_id, day, xp)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, day)
       DO UPDATE SET xp = daily_activity.xp + EXCLUDED.xp`,
      [userId, day, value],
    );
    await client.query(
      `UPDATE daily_activity da
          SET goal_met = da.xp >= u.daily_xp_goal
         FROM users u
        WHERE u.id = da.user_id AND da.user_id = $1 AND da.day = $2`,
      [userId, day],
    );
  }

  const totals = await recomputeUserXp(client, userId);
  return { awarded, amount: awarded ? value : 0, ...totals };
}

/**
 * Anula um ganho de XP.
 *
 * Usa-se quando o que deu o ponto deixa de existir — apagar uma receita, por
 * exemplo. Sem isto, publicar e apagar em ciclo somava XP por receitas que já
 * não existem: o `UNIQUE` só impede pagar duas vezes pelo MESMO `source_ref`,
 * e cada receita nova traz um id novo.
 *
 * Desconta também o dia em que o ponto foi ganho, não o dia de hoje — senão o
 * histórico de `daily_activity` deixava de bater certo com o livro-razão.
 */
export async function revokeXp(client, { userId, source, sourceRef, timeZone = "UTC" }) {
  const { rows } = await client.query(
    `DELETE FROM xp_events
      WHERE user_id = $1 AND source = $2 AND source_ref = $3
      RETURNING amount, created_at`,
    [userId, source, sourceRef],
  );

  const event = rows[0];
  if (!event) return { revoked: false, amount: 0, ...(await recomputeUserXp(client, userId)) };

  const value = Number(event.amount);
  if (value > 0) {
    const day = dayInTimeZone(event.created_at, timeZone);
    await client.query(
      `UPDATE daily_activity
          SET xp = GREATEST(0, xp - $3)
        WHERE user_id = $1 AND day = $2`,
      [userId, day, value],
    );
    await client.query(
      `UPDATE daily_activity da
          SET goal_met = da.xp >= u.daily_xp_goal
         FROM users u
        WHERE u.id = da.user_id AND da.user_id = $1 AND da.day = $2`,
      [userId, day],
    );
  }

  const totals = await recomputeUserXp(client, userId);
  return { revoked: true, amount: value, ...totals };
}

/** Estado diário derivado de daily_activity: streak, XP de hoje e meta. */
export async function loadDailyState(client, userId, { timeZone = "UTC", now = new Date() } = {}) {
  const today = dayInTimeZone(now, timeZone);

  const { rows } = await client.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, xp, goal_met
       FROM daily_activity
      WHERE user_id = $1
        AND day >= (now() - interval '400 days')::date
      ORDER BY day DESC`,
    [userId],
  );

  const activeDays = rows.filter((row) => Number(row.xp) > 0).map((row) => row.day);
  const todayRow = rows.find((row) => row.day === today);

  return {
    today,
    streak: computeStreak(activeDays, today),
    dailyXp: Number(todayRow?.xp ?? 0),
    goalMet: Boolean(todayRow?.goal_met),
    activeDays,
  };
}

/**
 * Bónus de streak, atribuído no máximo uma vez por dia (a referência é o dia),
 * quando o utilizador atinge um múltiplo de 7 dias seguidos.
 */
export async function awardStreakBonus(client, userId, { streak, today, timeZone, now }) {
  const bonus = streakBonusFor(streak);
  if (bonus <= 0) return { awarded: false, amount: 0 };

  const result = await awardXp(client, {
    userId,
    source: "streak",
    sourceRef: today,
    amount: bonus,
    timeZone,
    now,
  });
  return result;
}
