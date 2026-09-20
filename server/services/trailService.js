import { getAllTrailIds, trailExists, curriculumFor, DEFAULT_TRAIL } from "../domain/curriculum.js";

/**
 * Trail Service
 *
 * Manages trail operations: loading trail metadata, managing user progress,
 * and retrieving trail-specific curriculum data.
 */

export async function getAllAvailableTrails(db) {
  const trailIds = getAllTrailIds();
  const trails = [];

  for (const trailId of trailIds) {
    const trail = await getTrailMetadata(db, trailId);
    if (trail) {
      trails.push(trail);
    }
  }

  // Sort by order_index
  trails.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  return trails;
}

export async function getTrailMetadata(db, trailId) {
  if (!trailExists(trailId)) {
    return null;
  }

  const result = await db.query("SELECT * FROM trails WHERE id = $1", [trailId]);
  return result.rows[0] || null;
}

export async function getTrailCurriculum(trailId, lang = "en") {
  if (!trailExists(trailId)) {
    return null;
  }

  return curriculumFor(lang, trailId);
}

export async function getUserTrailProgress(db, userId, trailId) {
  const result = await db.query(
    "SELECT * FROM user_trail_progress WHERE user_id = $1 AND trail_id = $2",
    [userId, trailId],
  );
  return result.rows[0] || null;
}

export async function getUserTrails(db, userId) {
  const result = await db.query(
    "SELECT utp.*, t.name, t.icon, t.color, t.difficulty FROM user_trail_progress utp LEFT JOIN trails t ON utp.trail_id = t.id WHERE utp.user_id = $1 ORDER BY utp.started_at DESC",
    [userId],
  );
  return result.rows || [];
}

export async function startUserTrail(db, userId, trailId) {
  if (!trailExists(trailId)) {
    throw new Error(`Trail ${trailId} does not exist`);
  }

  // Insert or update user_trail_progress
  const result = await db.query(
    `INSERT INTO user_trail_progress (user_id, trail_id, started_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id, trail_id) DO UPDATE SET started_at = COALESCE(EXCLUDED.started_at, user_trail_progress.started_at)
     RETURNING *`,
    [userId, trailId],
  );
  return result.rows[0];
}

export async function updateUserTrailProgress(db, userId, trailId, updates) {
  const { current_unit_id } = updates;

  const result = await db.query(
    `UPDATE user_trail_progress
     SET current_unit_id = COALESCE($3, current_unit_id)
     WHERE user_id = $1 AND trail_id = $2
     RETURNING *`,
    [userId, trailId, current_unit_id],
  );
  return result.rows[0] || null;
}

export async function selectUserTrail(db, userId, trailId) {
  if (!trailExists(trailId)) {
    throw new Error(`Trail ${trailId} does not exist`);
  }

  // Start the trail if not already started
  await startUserTrail(db, userId, trailId);

  // Update user's current trail preference (we'll add this to users table later)
  // For now, return the trail progress
  return await getUserTrailProgress(db, userId, trailId);
}

export async function deleteUserTrail(db, userId, trailId) {
  const result = await db.query(
    "DELETE FROM user_trail_progress WHERE user_id = $1 AND trail_id = $2 RETURNING *",
    [userId, trailId],
  );
  return result.rows[0] || null;
}

export async function getTrailStats(db, trailId) {
  if (!trailExists(trailId)) {
    return null;
  }

  const curriculum = await getTrailCurriculum(trailId);
  if (!curriculum) {
    return null;
  }

  const stats = {
    trail_id: trailId,
    total_units: curriculum.units.length,
    total_lessons: curriculum.lessons.length,
    total_skills: curriculum.skills.length,
    total_missions: curriculum.missions.length,
  };

  // Get user progress stats
  const result = await db.query(
    `SELECT COUNT(*) as user_count FROM user_trail_progress WHERE trail_id = $1`,
    [trailId],
  );
  stats.users_started = parseInt(result.rows[0].user_count) || 0;

  return stats;
}
