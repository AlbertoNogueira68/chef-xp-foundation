import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function mapRecipe(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ingredients: row.ingredients,
    cookTimeMin: row.cook_time_min,
    difficulty: row.difficulty,
    xpReward: row.xp_reward,
    likesCount: row.likes_count,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      username: row.username,
      level: row.level,
    },
  };
}

const SELECT = `
  SELECT r.*, u.username, u.level
  FROM recipes r
  JOIN users u ON u.id = r.author_id
`;

router.get("/", requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    let result;
    if (q) {
      result = await query(
        `${SELECT}
         WHERE r.title ILIKE $1 OR r.description ILIKE $1 OR u.username ILIKE $1
         ORDER BY r.created_at DESC
         LIMIT 50`,
        [`%${q}%`],
      );
    } else {
      result = await query(`${SELECT} ORDER BY r.created_at DESC LIMIT 50`);
    }
    return res.json({ recipes: result.rows.map(mapRecipe) });
  } catch (error) {
    console.error("[recipes/list]", error);
    return res.status(500).json({ error: "Failed to load recipes" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, description, ingredients, cookTimeMin, difficulty } = req.body ?? {};
    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof ingredients !== "string" ||
      !title.trim() ||
      !description.trim() ||
      !ingredients.trim()
    ) {
      return res.status(400).json({ error: "title, description and ingredients are required" });
    }

    const allowed = new Set(["facil", "medio", "dificil"]);
    const diff = allowed.has(difficulty) ? difficulty : "medio";
    const minutes = Number.isFinite(Number(cookTimeMin)) ? Math.max(5, Number(cookTimeMin)) : 30;

    const { rows } = await query(
      `WITH inserted AS (
         INSERT INTO recipes (author_id, title, description, ingredients, cook_time_min, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *
       )
       SELECT i.*, u.username, u.level
       FROM inserted i
       JOIN users u ON u.id = i.author_id`,
      [req.user.id, title.trim(), description.trim(), ingredients.trim(), minutes, diff],
    );

    await query(`UPDATE users SET xp = xp + 25 WHERE id = $1`, [req.user.id]);

    return res.status(201).json({ recipe: mapRecipe(rows[0]) });
  } catch (error) {
    console.error("[recipes/create]", error);
    return res.status(500).json({ error: "Failed to create recipe" });
  }
});

router.post("/:id/like", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `WITH updated AS (
         UPDATE recipes SET likes_count = likes_count + 1
         WHERE id = $1
         RETURNING *
       )
       SELECT urow.*, u.username, u.level
       FROM updated urow
       JOIN users u ON u.id = urow.author_id`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Recipe not found" });
    return res.json({ recipe: mapRecipe(rows[0]) });
  } catch (error) {
    console.error("[recipes/like]", error);
    return res.status(500).json({ error: "Failed to like recipe" });
  }
});

export default router;
