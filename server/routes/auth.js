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
import { clearCsrfToken, issueCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { loginSchema, registerSchema } from "../schemas/index.js";
import { toPublicUser } from "../lib/mappers.js";

const router = Router();

const BCRYPT_ROUNDS = 12;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas tentativas de login. Tenta daqui a uns minutos." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados registos a partir deste dispositivo." },
});

const USER_COLUMNS = `id, username, email, photo_url, level, xp, time_zone, daily_xp_goal, created_at, updated_at`;

router.get("/csrf", (_req, res) => {
  res.json({ csrfToken: issueCsrfToken(res) });
});

router.post(
  "/register",
  registerLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { email, password, username } = req.valid.body;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    try {
      const { rows } = await query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING ${USER_COLUMNS}`,
        [username, email, passwordHash],
      );

      const user = rows[0];
      setAuthCookie(res, signToken({ sub: user.id, email: user.email }));
      issueCsrfToken(res);

      // O token nunca vai no corpo da resposta, nem em dev: se estivesse
      // acessível ao JavaScript, o cookie HttpOnly não servia de nada.
      res.status(201).json({
        user: toPublicUser(user, { includeEmail: true }),
        needsEmailConfirmation: false,
      });
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Email ou nome de utilizador já em uso" });
      }
      throw error;
    }
  }),
);

router.post(
  "/login",
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.valid.body;

    const { rows } = await query(
      `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`,
      [email],
    );
    const user = rows[0];

    // Mesma mensagem para email inexistente e password errada: não revela
    // quais os emails registados.
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    setAuthCookie(res, signToken({ sub: user.id, email: user.email }));
    issueCsrfToken(res);

    res.json({ user: toPublicUser(user, { includeEmail: true }) });
  }),
);

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  clearCsrfToken(res);
  res.json({ ok: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [
      req.user.id,
    ]);
    if (!rows[0]) return res.status(401).json({ error: "Unauthorized" });
    res.json({ user: toPublicUser(rows[0], { includeEmail: true }) });
  }),
);

export default router;
