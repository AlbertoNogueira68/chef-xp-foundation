import {
  getAllTrailIds,
  trailExists,
  curriculumFor,
  trailTextFor,
  getLessonOrder,
  DEFAULT_TRAIL,
  DEFAULT_LANGUAGE,
} from "../domain/curriculum.js";

/**
 * Trilhos: o que existe, quem os está a fazer, e onde vai cada um.
 *
 * Um trilho tem duas metades. O currículo — unidades, lições, missões — vive
 * em `shared/trails/<id>.json`, carregado e validado no arranque. Os
 * metadados — nome, cor, dificuldade, se está publicado — vivem na base de
 * dados, que é onde o administrador os pode mudar sem um deploy.
 *
 * Só aparece a quem aprende o que tem as duas: JSON carregado e linha
 * publicada. Um trilho sem currículo não se serve, e um currículo sem linha
 * publicada ainda é rascunho.
 */

/**
 * Põe o nome e a descrição da língua pedida por cima da linha da base de dados.
 *
 * A linha manda no estado — publicado, ordem, ícone escolhido pelo
 * administrador — e o JSON manda no texto, porque é ele que existe nas duas
 * línguas. Sem isto o catálogo de trilhos saía sempre em inglês.
 */
function naLingua(rows, lang) {
  return rows.map((trail) => ({ ...trail, ...trailTextFor(lang, trail.id) }));
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
 * O fundacional é o único trilho sem pré-requisito. Todos os outros só
 * abrem depois de todas as lições do fundacional estarem feitas — é o que
 * dá ao "Main Course" a função de introdução obrigatória em vez de mais um
 * trilho entre outros.
 */
export async function hasCompletedMainCourse(db, userId) {
  const total = getLessonOrder(DEFAULT_TRAIL).length;
  if (total === 0) return true;

  const { rows } = await db.query(
    `SELECT COUNT(DISTINCT lesson_id)::int AS feitas
       FROM lesson_progress
      WHERE user_id = $1 AND trail_id = $2`,
    [userId, DEFAULT_TRAIL],
  );
  return rows[0].feitas >= total;
}

/** A equipa pré-visualiza tudo, publicado ou não, feito o fundacional ou não. */
async function isTeamMember(db, userId) {
  const { rows } = await db.query(`SELECT (role <> 'user') AS equipa FROM users WHERE id = $1`, [
    userId,
  ]);
  return Boolean(rows[0]?.equipa);
}

/**
 * Quem pode abrir este trilho.
 *
 * Um rascunho é visível a quem o está a preparar e a mais ninguém. Um trilho
 * especializado só é visível depois do fundacional estar completo — os dois
 * bloqueios juntam-se aqui para que só haja um sítio a decidir "não". O papel
 * vem da base de dados de propósito: o token só transporta o id e o email, e
 * ler o papel de lá dava uma verificação que passava sempre.
 */
export async function canSeeTrail(db, userId, trailId) {
  if (trailId === DEFAULT_TRAIL) return true;

  const { rows } = await db.query(
    `SELECT (t.published_at IS NOT NULL) AS publicado,
            (u.role <> 'user')          AS equipa
       FROM users u
       LEFT JOIN trails t ON t.id = $2
      WHERE u.id = $1`,
    [userId, trailId],
  );

  const linha = rows[0];
  if (linha?.equipa) return true;
  if (!linha?.publicado) return false;
  return hasCompletedMainCourse(db, userId);
}

/**
 * Os trilhos que alguém pode escolher.
 *
 * Cruza os dois lados numa consulta só: sem isto era uma query por trilho, e
 * um trilho publicado cujo JSON não carregou continuava a aparecer na lista
 * para depois dar 404 ao ser aberto. Antes do fundacional estar completo, só
 * ele aparece — o resto fica escondido em vez de tentador e trancado.
 */
export async function getAllAvailableTrails(
  db,
  userId,
  { includeUnpublished = false, lang = DEFAULT_LANGUAGE } = {},
) {
  const loaded = getAllTrailIds();
  const desbloqueado =
    includeUnpublished || (await isTeamMember(db, userId)) || (await hasCompletedMainCourse(db, userId));

  const { rows } = await db.query(
    `SELECT * FROM trails
      WHERE id = ANY($1::text[])
        AND (published_at IS NOT NULL OR $2)
        AND (id = $3 OR $4)
      ORDER BY order_index ASC, name ASC`,
    [loaded, includeUnpublished, DEFAULT_TRAIL, desbloqueado],
  );
  return naLingua(rows, lang);
}

export async function getTrailMetadata(db, trailId, lang = DEFAULT_LANGUAGE) {
  const { rows } = await db.query(`SELECT * FROM trails WHERE id = $1`, [trailId]);
  if (!rows[0]) return null;
  return { ...rows[0], ...trailTextFor(lang, trailId) };
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

export async function getUserTrails(db, userId, lang = DEFAULT_LANGUAGE) {
  const { rows } = await db.query(
    `SELECT t.id, t.name, t.description, t.icon, t.color, t.difficulty, t.order_index,
            utp.started_at, utp.completed_at, utp.current_unit_id
       FROM user_trail_progress utp
       JOIN trails t ON t.id = utp.trail_id
      WHERE utp.user_id = $1
      ORDER BY utp.started_at DESC`,
    [userId],
  );
  return naLingua(rows, lang);
}

/**
 * Inscreve alguém num trilho. Idempotente: entrar duas vezes não reinicia o
 * `started_at` nem apaga o progresso de quem voltou.
 *
 * Um rascunho não se começa. Se isso fosse permitido, despublicar um trilho
 * deixava gente a meio de conteúdo que já não existe. E um trilho
 * especializado não se começa antes do fundacional estar completo — é o
 * mesmo bloqueio de `canSeeTrail`, repetido aqui porque começar um trilho não
 * passa por lá.
 */
export async function startUserTrail(db, userId, trailId) {
  if (!trailExists(trailId)) return null;
  if (trailId !== DEFAULT_TRAIL) {
    if (!(await isTrailPublished(db, trailId))) return null;
    if (!(await isTeamMember(db, userId)) && !(await hasCompletedMainCourse(db, userId))) {
      return null;
    }
  }

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
