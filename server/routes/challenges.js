import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { toChallenge } from "../lib/mappers.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, title, description, xp_reward, image_url, ends_at, created_at
         FROM challenges
        ORDER BY (ends_at > now()) DESC, ends_at ASC
        LIMIT 50`,
    );
    res.json({ challenges: rows.map(toChallenge) });
  }),
);

export default router;
