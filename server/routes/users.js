import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    photoUrl: row.photo_url,
    level: row.level,
    xp: row.xp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, username, email, photo_url, level, xp, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.id],
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user: toPublicUser(rows[0]) });
  } catch (error) {
    console.error("[users/me]", error);
    return res.status(500).json({ error: "Failed to load user" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, username, email, photo_url, level, xp, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.params.id],
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user: toPublicUser(rows[0]) });
  } catch (error) {
    console.error("[users/:id]", error);
    return res.status(500).json({ error: "Failed to load user" });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { username, photoUrl } = req.body ?? {};
    const fields = [];
    const values = [];
    let i = 1;

    if (typeof username === "string" && username.trim()) {
      fields.push(`username = $${i++}`);
      values.push(username.trim().toLowerCase());
    }
    if (photoUrl === null || typeof photoUrl === "string") {
      fields.push(`photo_url = $${i++}`);
      values.push(photoUrl);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(req.user.id);
    const { rows } = await query(
      `UPDATE users SET ${fields.join(", ")}
       WHERE id = $${i}
       RETURNING id, username, email, photo_url, level, xp, created_at, updated_at`,
      values,
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user: toPublicUser(rows[0]) });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Username already in use" });
    }
    console.error("[users/patch]", error);
    return res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
