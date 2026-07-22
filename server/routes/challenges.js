import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function mapChallenge(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    xpReward: row.xp_reward,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    active: new Date(row.ends_at) > new Date(),
  };
}

router.get("/", requireAuth, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM challenges
       ORDER BY ends_at ASC
       LIMIT 50`,
    );
    return res.json({ challenges: rows.map(mapChallenge) });
  } catch (error) {
    console.error("[challenges/list]", error);
    return res.status(500).json({ error: "Failed to load challenges" });
  }
});

export default router;
