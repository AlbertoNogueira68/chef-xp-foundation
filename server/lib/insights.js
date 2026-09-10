import { query } from "../db/index.js";

/**
 * As consultas da análise. Só leituras, e todas com o denominador à vista —
 * a interpretação é feita em `domain/insights.js`, que não sabe o que é SQL.
 */

/** Quantas pessoas e quantas runs existem. Sem isto, nenhuma taxa se lê. */
export async function loadScale() {
  const { rows } = await query(`
    SELECT
      (SELECT count(*) FROM users)                                  AS users,
      (SELECT count(*) FROM mission_runs)                           AS runs,
      (SELECT count(DISTINCT user_id) FROM mission_runs)            AS cooks,
      (SELECT count(*) FROM mission_events)                         AS events,
      (SELECT count(*) FROM cooking_plans)                          AS plans,
      (SELECT min(started_at)::date FROM mission_runs)              AS first_run,
      (SELECT max(started_at)::date FROM mission_runs)              AS last_run
  `);
  return rows[0];
}

export async function loadRunsByStatus() {
  const { rows } = await query(
    `SELECT status, count(*)::int AS runs FROM mission_runs GROUP BY status`,
  );
  return rows;
}

export async function loadRunsByMission() {
  const { rows } = await query(`
    SELECT mission_id,
           count(*)::int                                                  AS runs,
           count(*) FILTER (WHERE status = 'completed')::int              AS completed,
           count(*) FILTER (WHERE status = 'abandoned')::int              AS abandoned,
           count(*) FILTER (WHERE status = 'in_progress')::int            AS open
      FROM mission_runs
     GROUP BY mission_id
     ORDER BY runs DESC
  `);
  return rows;
}

/**
 * Eventos por passo, com o número de runs da missão ao lado: dez pedidos de
 * socorro num passo dizem coisas diferentes se houve doze runs ou duzentas.
 */
export async function loadStepEvents() {
  const { rows } = await query(`
    SELECT r.mission_id,
           e.step_index,
           e.kind,
           count(*)::int AS events,
           (SELECT count(*)::int FROM mission_runs r2 WHERE r2.mission_id = r.mission_id) AS runs
      FROM mission_events e
      JOIN mission_runs r ON r.id = e.run_id
     GROUP BY r.mission_id, e.step_index, e.kind
  `);
  return rows;
}

export async function loadRescueKinds() {
  const { rows } = await query(`
    SELECT detail, count(*)::int AS events
      FROM mission_events
     WHERE kind = 'rescue'
     GROUP BY detail
  `);
  return rows;
}

/**
 * Onde as runs que nunca acabaram ficaram paradas.
 *
 * Inclui as que continuam 'in_progress': é a desistência silenciosa, e é a
 * comum. Quem fecha a app a meio de cozinhar não carrega em "abandonar".
 */
export async function loadStallPoints() {
  const { rows } = await query(`
    SELECT mission_id, status, current_step, count(*)::int AS runs
      FROM mission_runs
     WHERE status <> 'completed'
     GROUP BY mission_id, status, current_step
     ORDER BY runs DESC
  `);
  return rows;
}

/** Minutos de cada run concluída, para a mediana. */
export async function loadDurations() {
  const { rows } = await query(`
    SELECT mission_id,
           EXTRACT(EPOCH FROM (completed_at - started_at)) / 60.0 AS minutes
      FROM mission_runs
     WHERE status = 'completed' AND completed_at IS NOT NULL
  `);
  return rows;
}

/**
 * Adesão ao compromisso, semana a semana.
 *
 * Só dias resolvidos: cumpridos ou falhados. Um dia prometido que ainda não
 * chegou não conta para nenhum dos lados.
 */
export async function loadAdherenceByWeek() {
  const { rows } = await query(`
    SELECT date_trunc('week', planned_on)::date                                AS week,
           count(*) FILTER (WHERE status = 'done'   AND promised)::int         AS done,
           count(*) FILTER (WHERE status = 'missed' AND promised)::int         AS missed,
           count(*) FILTER (WHERE status = 'done'   AND NOT promised)::int     AS spontaneous
      FROM cooking_sessions
     GROUP BY 1
     ORDER BY 1
  `);
  return rows;
}

/** Uso dos temporizadores e da voz, em runs distintas. */
export async function loadFeatureUse() {
  const { rows } = await query(`
    SELECT kind,
           count(*)::int                    AS events,
           count(DISTINCT run_id)::int      AS runs
      FROM mission_events
     WHERE kind IN ('timer', 'voice')
     GROUP BY kind
  `);
  return rows;
}
