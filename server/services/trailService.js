import {
  getAllTrailIds,
  trailExists,
  curriculumFor,
  registerTrail,
  unregisterTrail,
  DEFAULT_TRAIL,
} from "../domain/curriculum.js";

/**
 * Trilhos: o que existe, quem os está a fazer, e onde vai cada um.
 *
 * Um trilho tem duas metades. O currículo — unidades, lições, missões — vive
 * no JSON e é carregado e validado no arranque. Os metadados — nome, cor,
 * dificuldade, se está publicado — vivem na base de dados, que é onde o
 * administrador lhes pode mexer sem um deploy.
 *
 * Só aparece a quem aprende o que tem as duas: JSON carregado e linha
 * publicada. Um trilho sem currículo não se serve, e um currículo sem linha
 * publicada ainda é rascunho.
 */

/**
 * Põe em circulação os trilhos escritos pelo painel.
 *
 * Corre no arranque, a seguir às migrations e antes do sync do currículo —
 * as competências destes trilhos também têm de chegar à tabela `skills`, ou
 * a primeira missão concluída rebenta na chave estrangeira.
 *
 * Um trilho com currículo inválido é deixado de fora e comunicado. Não é
 * motivo para o servidor não subir: o conteúdo é de quem o escreveu pelo
 * painel, e derrubar a aplicação inteira por causa dele seria dar a um
 * administrador distraído um botão de desligar.
 */
export async function loadDbTrails(db) {
  const { rows } = await db.query(
    `SELECT id, curriculum_json FROM trails WHERE curriculum_json IS NOT NULL`,
  );

  const carregados = [];
  const rejeitados = [];

  for (const row of rows) {
    const porLingua = row.curriculum_json?.en ? row.curriculum_json : { en: row.curriculum_json };

    const { ok, errors } = registerTrail(row.id, porLingua);
    if (ok) carregados.push(row.id);
    else rejeitados.push({ id: row.id, errors });
  }

  return { carregados, rejeitados };
}

/** Um trilho está publicado quando a linha existe e tem `published_at`. */
export async function isTrailPublished(db, trailId) {
  const { rows } = await db.query(
    `SELECT 1 FROM trails WHERE id = $1 AND published_at IS NOT NULL`,
    [trailId],
  );
  return rows.length > 0;
}

/**
 * Os trilhos que alguém pode escolher.
 *
 * Cruza os dois lados numa consulta só: sem isto era uma query por trilho, e
 * um trilho publicado cujo JSON não carregou continuava a aparecer na lista
 * para depois dar 404 ao ser aberto.
 */
export async function getAllAvailableTrails(db, { includeUnpublished = false } = {}) {
  const loaded = getAllTrailIds();

  const { rows } = await db.query(
    `SELECT * FROM trails
      WHERE id = ANY($1::text[])
        AND (published_at IS NOT NULL OR $2)
      ORDER BY order_index ASC, name ASC`,
    [loaded, includeUnpublished],
  );
  return rows;
}

export async function getTrailMetadata(db, trailId) {
  const { rows } = await db.query(`SELECT * FROM trails WHERE id = $1`, [trailId]);
  return rows[0] ?? null;
}

/** O currículo de um trilho, ou `null` se esse trilho não foi carregado. */
export function getTrailCurriculum(trailId, lang = "en") {
  if (!trailExists(trailId)) return null;
  return curriculumFor(lang, trailId);
}

export async function getUserTrailProgress(db, userId, trailId) {
  const { rows } = await db.query(
    `SELECT * FROM user_trail_progress WHERE user_id = $1 AND trail_id = $2`,
    [userId, trailId],
  );
  return rows[0] ?? null;
}

export async function getUserTrails(db, userId) {
  const { rows } = await db.query(
    `SELECT t.id, t.name, t.description, t.icon, t.color, t.difficulty, t.order_index,
            utp.started_at, utp.completed_at, utp.current_unit_id
       FROM user_trail_progress utp
       JOIN trails t ON t.id = utp.trail_id
      WHERE utp.user_id = $1
      ORDER BY utp.started_at DESC`,
    [userId],
  );
  return rows;
}

/**
 * Inscreve alguém num trilho. Idempotente: entrar duas vezes não reinicia o
 * `started_at` nem apaga o progresso de quem voltou.
 *
 * Um rascunho não se começa. Se isso fosse permitido, despublicar um trilho
 * deixava gente a meio de conteúdo que já não existe.
 */
export async function startUserTrail(db, userId, trailId) {
  if (!trailExists(trailId)) return null;
  if (trailId !== DEFAULT_TRAIL && !(await isTrailPublished(db, trailId))) return null;

  const { rows } = await db.query(
    `INSERT INTO user_trail_progress (user_id, trail_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, trail_id) DO UPDATE SET trail_id = EXCLUDED.trail_id
     RETURNING *`,
    [userId, trailId],
  );
  return rows[0];
}

export async function updateUserTrailProgress(db, userId, trailId, { currentUnitId }) {
  const { rows } = await db.query(
    `UPDATE user_trail_progress
        SET current_unit_id = COALESCE($3, current_unit_id)
      WHERE user_id = $1 AND trail_id = $2
      RETURNING *`,
    [userId, trailId, currentUnitId ?? null],
  );
  return rows[0] ?? null;
}

export async function deleteUserTrail(db, userId, trailId) {
  const { rows } = await db.query(
    `DELETE FROM user_trail_progress WHERE user_id = $1 AND trail_id = $2 RETURNING *`,
    [userId, trailId],
  );
  return rows[0] ?? null;
}
