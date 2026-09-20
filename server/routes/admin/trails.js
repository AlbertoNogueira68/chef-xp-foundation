import { Router } from "express";
import { getPool } from "../../db/index.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { curriculumFor, trailExists } from "../../domain/curriculum.js";
import { getAllAvailableTrails, getTrailMetadata } from "../../services/trailService.js";

const router = Router();

// Note: Admin middleware is already applied by parent router (admin.js)

/**
 * GET /admin/trails - List all trails (published and drafts)
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows: trails } = await getPool().query(
      `SELECT * FROM trails ORDER BY order_index ASC, created_at DESC`,
    );
    res.json({ trails });
  }),
);

/**
 * GET /admin/trails/:trailId - Get specific trail metadata and curriculum
 */
router.get(
  "/:trailId",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) {
      return res.status(404).json({ error: "Trail not found" });
    }

    const curriculum = curriculumFor("en", req.params.trailId);
    res.json({
      metadata: trail,
      curriculum,
    });
  }),
);

/**
 * POST /admin/trails - Create a new trail
 * Body:
 * {
 *   id: string (unique identifier, e.g., "italian-cooking")
 *   name: string
 *   description: string (optional)
 *   icon: string (emoji or lucide-react name)
 *   color: string (tailwind color, e.g., "emerald")
 *   difficulty: string ("beginner" | "intermediate" | "advanced")
 *   curriculum: object (the full curriculum JSON)
 * }
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      id,
      name,
      description,
      icon,
      color,
      difficulty,
      order_index,
    } = req.body;

    // Validate required fields
    if (!id || !name || !difficulty) {
      return res.status(400).json({
        error: "Missing required fields: id, name, difficulty",
      });
    }

    // Validate difficulty
    if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
      return res.status(400).json({
        error: "Invalid difficulty. Must be: beginner, intermediate, or advanced",
      });
    }

    // Check if trail already exists
    const existing = await getPool().query("SELECT 1 FROM trails WHERE id = $1", [id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Trail already exists" });
    }

    // Create trail in database (as draft)
    const result = await getPool().query(
      `INSERT INTO trails (id, name, description, icon, color, difficulty, order_index, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING *`,
      [id, name, description || null, icon || null, color || "slate", difficulty, order_index || 0],
    );

    res.status(201).json({
      success: true,
      trail: result.rows[0],
      message: `Trail "${name}" created as draft. Publish when ready.`,
    });
  }),
);

/**
 * PUT /admin/trails/:trailId - Update trail metadata (only drafts)
 */
router.put(
  "/:trailId",
  asyncHandler(async (req, res) => {
    const { name, description, icon, color, difficulty, order_index } = req.body;

    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) {
      return res.status(404).json({ error: "Trail not found" });
    }

    // Prevent editing published trails
    if (trail.published_at) {
      return res.status(403).json({
        error: "Cannot edit published trails. Unpublish first.",
      });
    }

    // Validate difficulty if provided
    if (difficulty && !["beginner", "intermediate", "advanced"].includes(difficulty)) {
      return res.status(400).json({
        error: "Invalid difficulty. Must be: beginner, intermediate, or advanced",
      });
    }

    const updates = [];
    const params = [req.params.trailId];
    let paramCount = 2;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      params.push(name);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description || null);
      paramCount++;
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramCount}`);
      params.push(icon || null);
      paramCount++;
    }
    if (color !== undefined) {
      updates.push(`color = $${paramCount}`);
      params.push(color || "slate");
      paramCount++;
    }
    if (difficulty !== undefined) {
      updates.push(`difficulty = $${paramCount}`);
      params.push(difficulty);
      paramCount++;
    }
    if (order_index !== undefined) {
      updates.push(`order_index = $${paramCount}`);
      params.push(order_index);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.json({
        success: true,
        trail,
        message: "No changes provided",
      });
    }

    updates.push(`updated_at = now()`);

    const result = await getPool().query(
      `UPDATE trails SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
      params,
    );

    res.json({
      success: true,
      trail: result.rows[0],
    });
  }),
);

/**
 * POST /admin/trails/:trailId/publish - Publish a trail (make it visible to users)
 */
router.post(
  "/:trailId/publish",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) {
      return res.status(404).json({ error: "Trail not found" });
    }

    if (trail.published_at) {
      return res.json({
        success: true,
        trail,
        message: "Trail already published",
      });
    }

    // Verify curriculum exists and is valid
    const curriculum = curriculumFor("en", req.params.trailId);
    if (!curriculum) {
      return res.status(400).json({
        error: "Curriculum not found. Cannot publish trail without curriculum.",
      });
    }

    const result = await getPool().query(
      `UPDATE trails SET published_at = now(), published_by = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.trailId, req.user.id],
    );

    res.json({
      success: true,
      trail: result.rows[0],
      message: `Trail "${trail.name}" published successfully`,
    });
  }),
);

/**
 * POST /admin/trails/:trailId/unpublish - Unpublish a trail (hide from users)
 */
router.post(
  "/:trailId/unpublish",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) {
      return res.status(404).json({ error: "Trail not found" });
    }

    if (!trail.published_at) {
      return res.json({
        success: true,
        trail,
        message: "Trail is already a draft",
      });
    }

    const result = await getPool().query(
      `UPDATE trails SET published_at = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.trailId],
    );

    res.json({
      success: true,
      trail: result.rows[0],
      message: `Trail reverted to draft`,
    });
  }),
);

/**
 * DELETE /admin/trails/:trailId - Delete a trail (only if no users have started it)
 */
router.delete(
  "/:trailId",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) {
      return res.status(404).json({ error: "Trail not found" });
    }

    // Check if any users have started this trail
    const { rows: userProgress } = await getPool().query(
      "SELECT COUNT(*) as count FROM user_trail_progress WHERE trail_id = $1",
      [req.params.trailId],
    );

    if (parseInt(userProgress[0].count) > 0) {
      return res.status(403).json({
        error: `Cannot delete trail with ${userProgress[0].count} user(s) enrolled. Unpublish instead.`,
      });
    }

    await getPool().query("DELETE FROM trails WHERE id = $1", [req.params.trailId]);

    res.json({
      success: true,
      message: `Trail "${trail.name}" deleted`,
    });
  }),
);

/**
 * GET /admin/trails/:trailId/preview - Preview a trail before publishing
 */
router.get(
  "/:trailId/preview",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) {
      return res.status(404).json({ error: "Trail not found" });
    }

    const curriculum = curriculumFor("en", req.params.trailId);
    if (!curriculum) {
      return res.status(400).json({ error: "Curriculum not found" });
    }

    // Return a preview of the trail structure
    const preview = {
      metadata: {
        id: trail.id,
        name: trail.name,
        description: trail.description,
        icon: trail.icon,
        color: trail.color,
        difficulty: trail.difficulty,
        published: !!trail.published_at,
      },
      structure: {
        units: curriculum.units.length,
        lessons: curriculum.lessons.length,
        skills: curriculum.skills.length,
        missions: curriculum.missions.length,
      },
      units: curriculum.units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        subtitle: unit.subtitle,
        lessonsCount: unit.lessons.length,
        missions: unit.missionId ? 1 : 0,
      })),
    };

    res.json(preview);
  }),
);

/**
 * GET /admin/trails/:trailId/stats - Get analytics for a trail
 */
router.get(
  "/:trailId/stats",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) {
      return res.status(404).json({ error: "Trail not found" });
    }

    const curriculum = curriculumFor("en", req.params.trailId);
    if (!curriculum) {
      return res.status(400).json({ error: "Curriculum not found" });
    }

    // User engagement stats
    const { rows: enrollmentRows } = await getPool().query(
      `SELECT COUNT(*) as total_users,
              COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_users
       FROM user_trail_progress
       WHERE trail_id = $1`,
      [req.params.trailId],
    );

    const enrollment = enrollmentRows[0];

    // Lesson completion stats
    const { rows: lessonStats } = await getPool().query(
      `SELECT COUNT(DISTINCT user_id) as users_with_progress,
              COUNT(DISTINCT lesson_id) as lessons_started,
              AVG(hearts_left) as avg_hearts
       FROM lesson_progress
       WHERE trail_id = $1`,
      [req.params.trailId],
    );

    res.json({
      metadata: trail,
      curriculum: {
        units: curriculum.units.length,
        lessons: curriculum.lessons.length,
        skills: curriculum.skills.length,
        missions: curriculum.missions.length,
      },
      engagement: {
        total_enrollments: parseInt(enrollment.total_users) || 0,
        completed: parseInt(enrollment.completed_users) || 0,
        in_progress: (parseInt(enrollment.total_users) || 0) - (parseInt(enrollment.completed_users) || 0),
      },
      lessons: lessonStats[0],
    });
  }),
);

export default router;
