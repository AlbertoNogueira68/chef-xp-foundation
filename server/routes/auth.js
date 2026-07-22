import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { query } from "../db/index.js";
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken,
} from "../middleware/auth.js";
import { issueCsrfToken } from "../middleware/csrf.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts" },
});

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

router.get("/csrf", (_req, res) => {
  const token = issueCsrfToken(res);
  res.json({ csrfToken: token });
});

router.post("/register", async (req, res) => {
  try {
    const { email, password, username } = req.body ?? {};
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof username !== "string"
    ) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedEmail || password.length < 6 || normalizedUsername.length < 3) {
      return res.status(400).json({ error: "Invalid email, password, or username" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, photo_url, level, xp, created_at, updated_at`,
      [normalizedUsername, normalizedEmail, passwordHash],
    );

    const user = rows[0];
    const token = signToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);
    issueCsrfToken(res);

    const body = {
      user: toPublicUser(user),
      needsEmailConfirmation: false,
    };
    if (process.env.NODE_ENV !== "production") {
      body.token = token;
    }
    return res.status(201).json(body);
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Email or username already in use" });
    }
    console.error("[auth/register]", error);
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const { rows } = await query(
      `SELECT id, username, email, password_hash, photo_url, level, xp, created_at, updated_at
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()],
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);
    issueCsrfToken(res);

    const body = { user: toPublicUser(user) };
    if (process.env.NODE_ENV !== "production") {
      body.token = token;
    }
    return res.json(body);
  } catch (error) {
    console.error("[auth/login]", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.clearCookie("csrf", { path: "/" });
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, username, email, photo_url, level, xp, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.id],
    );
    if (!rows[0]) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.json({ user: toPublicUser(rows[0]) });
  } catch (error) {
    console.error("[auth/me]", error);
    return res.status(500).json({ error: "Failed to load session" });
  }
});

export default router;
