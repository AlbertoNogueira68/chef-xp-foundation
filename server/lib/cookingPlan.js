import {
  normalizeWeekdays,
  plannedDatesForWeek,
  resolveTarget,
  startOfWeek,
  summarizeWeek,
  todayFor,
  weekDates,
} from "../domain/plan.js";

/**
 * O compromisso do lado da base de dados.
 *
 * Fica em `lib/` e não em `domain/` porque toca no cliente de Postgres; as
 * decisões (que dias, o que conta, o que falhou) estão todas em
 * `domain/plan.js`, sem I/O e com testes.
 */

function toPlan(row) {
  if (!row) return null;
  const weekdays = normalizeWeekdays(row.weekdays ?? []);
  return {
    weekdays,
    targetWeek: resolveTarget({ weekdays, targetWeek: row.target_week }),
    // O dia em que o compromisso passou a existir. Nada antes disto conta
    // como falhado.
    startedOn: row.updated_at ? row.updated_at.toISOString().slice(0, 10) : null,
    updatedAt: row.updated_at,
  };
}

export async function loadPlanRow(client, userId) {
  const { rows } = await client.query(
    `SELECT user_id, weekdays, target_week, updated_at FROM cooking_plans WHERE user_id = $1`,
    [userId],
  );
  return toPlan(rows[0]);
}

async function weekSessions(client, userId, weekStart) {
  const dates = weekDates(weekStart);
  const { rows } = await client.query(
    `SELECT planned_on, status, mission_id, run_id
       FROM cooking_sessions
      WHERE user_id = $1 AND planned_on BETWEEN $2::date AND $3::date
      ORDER BY planned_on`,
    [userId, dates[0], dates[6]],
  );
  return rows.map((row) => ({
    plannedOn: row.planned_on.toISOString().slice(0, 10),
    status: row.status,
    missionId: row.mission_id,
    runId: row.run_id === null ? null : Number(row.run_id),
  }));
}

/**
 * Põe a semana em dia antes de a ler.
 *
 * Duas coisas, ambas idempotentes e ambas só sobre o presente e o futuro:
 *
 * 1. O que foi prometido para hoje ou para os próximos dias ganha linha. É o
 *    registo do compromisso, e é o que faz mudar de plano não apagar as falhas
 *    do plano anterior.
 * 2. O que ficou para trás por cumprir passa a falhado. Falhar é uma
 *    consequência do tempo passar, não de uma ação — e como este projeto não
 *    tem agendador, o momento de reparar nisso é a leitura.
 *
 * Nunca cria linhas para trás: um plano feito hoje não inventa promessas que
 * ninguém chegou a fazer.
 */
export async function syncWeek(client, userId, plan, today) {
  if (!plan) return;

  const weekStart = startOfWeek(today);
  const upcoming = plannedDatesForWeek(plan.weekdays, weekStart).filter((date) => date >= today);

  if (upcoming.length > 0) {
    await client.query(
      `INSERT INTO cooking_sessions (user_id, planned_on, status)
       SELECT $1, d::date, 'planned' FROM unnest($2::date[]) AS d
       ON CONFLICT (user_id, planned_on) DO NOTHING`,
      [userId, upcoming],
    );
  }

  await client.query(
    `UPDATE cooking_sessions
        SET status = 'missed'
      WHERE user_id = $1 AND status = 'planned' AND planned_on < $2::date`,
    [userId, today],
  );
}

/** O plano e o estado da semana, já sincronizados. */
export async function loadPlanState(client, userId, timeZone, now = new Date()) {
  const today = todayFor(timeZone, now);
  const plan = await loadPlanRow(client, userId);

  if (!plan) return { plan: null, summary: null, today };

  await syncWeek(client, userId, plan, today);
  const sessions = await weekSessions(client, userId, startOfWeek(today));

  return { plan, summary: summarizeWeek({ plan, sessions, today }), today };
}

/**
 * Marca o dia como cozinhado.
 *
 * Chamado ao concluir uma missão, dentro da mesma transação. Cozinhar num dia
 * que não estava prometido conta na mesma — a linha nasce aqui se não existir.
 * Quem cozinhou, cozinhou; o dia prometido que ficou por cumprir continua
 * falhado, e as duas coisas aparecem lado a lado.
 *
 * Sem plano nenhum não se grava nada: sem compromisso não há semana a contar,
 * e o cozinhado já vive em `mission_runs`.
 */
export async function markCookedToday(client, userId, { missionId, runId, timeZone, now }) {
  const plan = await loadPlanRow(client, userId);
  if (!plan) return null;

  const today = todayFor(timeZone, now);

  // Cozinhar duas vezes no mesmo dia não conta duas vezes: o compromisso é
  // sobre dias, não sobre quantidade. O primeiro é que fica.
  const { rows } = await client.query(
    `INSERT INTO cooking_sessions (user_id, planned_on, mission_id, run_id, status)
     VALUES ($1, $2::date, $3, $4, 'done')
     ON CONFLICT (user_id, planned_on) DO UPDATE
       SET status = 'done',
           mission_id = COALESCE(cooking_sessions.mission_id, EXCLUDED.mission_id),
           run_id     = COALESCE(cooking_sessions.run_id, EXCLUDED.run_id)
     RETURNING planned_on`,
    [userId, today, missionId, runId],
  );

  return rows[0] ? today : null;
}
