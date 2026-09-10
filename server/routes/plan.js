import { Router } from "express";
import { getPool, query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { planUpsertSchema } from "../schemas/index.js";
import { bannerMessage, normalizeWeekdays, resolveTarget, todayFor } from "../domain/plan.js";
import { loadPlanState } from "../lib/cookingPlan.js";

const router = Router();
router.use(requireAuth);

async function userTimeZone(userId) {
  const { rows } = await query(`SELECT time_zone FROM users WHERE id = $1`, [userId]);
  return rows[0]?.time_zone ?? "UTC";
}

function respond(res, state) {
  res.json({
    plan: state.plan,
    summary: state.summary,
    message: bannerMessage(state.summary),
    today: state.today,
  });
}

/**
 * O compromisso e o estado da semana.
 *
 * A leitura tem efeitos: é aqui que os dias prometidos ganham linha e que os
 * que ficaram para trás passam a falhados. Num projeto sem agendador, o
 * momento de reparar que o tempo passou é quando alguém olha.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const state = await loadPlanState(client, req.user.id, await userTimeZone(req.user.id));
      await client.query("COMMIT");
      respond(res, state);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

/**
 * Assumir ou mudar o compromisso.
 *
 * `updated_at` é a data em que o compromisso actual passou a existir, e é o
 * que impede que se deva um dia anterior à promessa. Mudar de plano mexe essa
 * fronteira de propósito: o que se deve é o que se prometeu agora.
 */
router.put(
  "/",
  validate({ body: planUpsertSchema }),
  asyncHandler(async (req, res) => {
    const weekdays = normalizeWeekdays(req.valid.body.weekdays);
    const targetWeek = resolveTarget({ weekdays, targetWeek: req.valid.body.targetWeek });

    const timeZone = await userTimeZone(req.user.id);
    const today = todayFor(timeZone);

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO cooking_plans (user_id, weekdays, target_week, updated_at)
         VALUES ($1, $2::smallint[], $3, now())
         ON CONFLICT (user_id) DO UPDATE
           SET weekdays = EXCLUDED.weekdays,
               target_week = EXCLUDED.target_week,
               updated_at = now()`,
        [req.user.id, weekdays, targetWeek],
      );

      // Dias que deixaram de estar prometidos e ainda não chegaram: a promessa
      // deixou de existir, por isso a linha também. O passado fica como está.
      await client.query(
        `DELETE FROM cooking_sessions
          WHERE user_id = $1
            AND status = 'planned'
            AND planned_on >= $3::date
            AND ($2::smallint[] = '{}'::smallint[]
                 OR NOT (EXTRACT(ISODOW FROM planned_on)::smallint = ANY($2::smallint[])))`,
        [req.user.id, weekdays, today],
      );

      const state = await loadPlanState(client, req.user.id, timeZone);
      await client.query("COMMIT");
      respond(res, state);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

/**
 * Desistir do compromisso.
 *
 * Apaga o plano e as promessas que ainda não chegaram. O que já aconteceu —
 * cozinhados e falhas — fica: é o historial da pessoa, não do plano.
 */
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const today = todayFor(await userTimeZone(req.user.id));

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM cooking_sessions
          WHERE user_id = $1 AND status = 'planned' AND planned_on >= $2::date`,
        [req.user.id, today],
      );
      await client.query(`DELETE FROM cooking_plans WHERE user_id = $1`, [req.user.id]);
      await client.query("COMMIT");
      res.json({ plan: null, summary: null, message: null });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
