import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { getPool, query } from "../db/index.js";
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
import { baseCookieOptions } from "../lib/cookies.js";
import {
  buildGoogleAuthUrl,
  exchangeCodeForIdToken,
  googleClientId,
  isGoogleConfigured,
} from "../lib/googleOauth.js";
import {
  decodeJwtPayload,
  pickAvailableUsername,
  usernameFromEmail,
  validateIdTokenClaims,
} from "../domain/oauth.js";

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

    // Uma conta criada por SSO não tem password. Dizer "credenciais
    // inválidas" mandava a pessoa tentar recuperar uma password que nunca
    // existiu — aqui a mensagem específica não revela nada que a própria
    // pessoa não saiba já ao ver o botão do Google.
    if (user && user.password_hash === null) {
      return res.status(409).json({
        error: "Esta conta entra com o Google. Usa o botão «Continuar com Google».",
      });
    }

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

/* ------------------------------------------------------------------ */
/* Início de sessão com a Google                                      */
/* ------------------------------------------------------------------ */

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/**
 * O cookie de `state` NÃO pode ser SameSite=Strict.
 *
 * Em produção os cookies desta app são strict, e isso está certo para a
 * sessão. Mas o regresso da Google é uma navegação de topo vindo de outro
 * site: um cookie strict não seria enviado nesse pedido, o `state` chegaria
 * vazio e o login falhava sempre — só em produção, que é o pior sítio para
 * descobrir isso. Lax permite exatamente este caso (navegação de topo por
 * GET) e continua a bloquear pedidos cross-site que interessam.
 */
function oauthStateCookieOptions() {
  return {
    ...baseCookieOptions(),
    sameSite: "lax",
    httpOnly: true,
    maxAge: OAUTH_STATE_TTL_MS,
  };
}

/** Para onde a app volta depois do redirecionamento. Nunca vem do pedido. */
function frontendUrl(path = "/") {
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${base}${path}`;
}

/** O cliente pergunta o que existe antes de desenhar o botão. */
router.get("/providers", (_req, res) => {
  res.json({ google: isGoogleConfigured() });
});

router.get("/google", (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(404).json({ error: "Início de sessão com Google não está configurado" });
  }

  // O `state` é a defesa contra CSRF no fluxo OAuth: quem regressa tem de
  // trazer o mesmo valor que nós plantámos no browser antes de sair.
  const state = crypto.randomBytes(32).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());
  res.redirect(buildGoogleAuthUrl({ state }));
});

/**
 * Regresso da Google.
 *
 * Responde sempre com um redirecionamento para a própria app — nunca para um
 * endereço vindo do pedido — porque um callback de OAuth que aceitasse um
 * destino do exterior seria um open redirect com sessão acabada de criar.
 */
router.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const fail = (reason) =>
      res.redirect(`${frontendUrl("/auth")}?erro=${encodeURIComponent(reason)}`);

    if (!isGoogleConfigured()) return fail("Google não configurado");

    const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, { ...baseCookieOptions(), sameSite: "lax" });

    if (req.query.error) return fail("Autorização cancelada");

    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!cookieState || !state || cookieState !== state) {
      return fail("Pedido inválido ou expirado");
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) return fail("A Google não devolveu código");

    let claims;
    try {
      claims = decodeJwtPayload(await exchangeCodeForIdToken(code));
    } catch {
      return fail("Não foi possível falar com a Google");
    }

    const check = validateIdTokenClaims(claims, { clientId: googleClientId() });
    if (!check.ok) return fail(check.reason);

    const email = String(claims.email).toLowerCase();
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      // 1. Já conhecemos esta identidade Google?
      const { rows: linked } = await client.query(
        `UPDATE auth_identities
            SET last_login_at = now(), email = $2
          WHERE provider = 'google' AND subject = $1
        RETURNING user_id`,
        [claims.sub, email],
      );

      let userId = linked[0]?.user_id ?? null;

      if (!userId) {
        // 2. Existe uma conta local com este email? Liga-se a ela.
        //
        //    Só é seguro porque `email_verified` já foi exigido acima: sem
        //    isso, criar uma conta Google com o email de outra pessoa dava
        //    acesso à conta dela aqui.
        const { rows: existing } = await client.query(
          `SELECT id FROM users WHERE email = $1`,
          [email],
        );

        if (existing[0]) {
          userId = existing[0].id;
        } else {
          // 3. Conta nova. Sem password: entra-se por aqui e mais nada.
          const base = usernameFromEmail(email);
          const { rows: taken } = await client.query(
            `SELECT username FROM users WHERE username LIKE $1`,
            [`${base}%`],
          );
          const username = pickAvailableUsername(
            base,
            taken.map((row) => row.username),
          );

          const { rows: created } = await client.query(
            `INSERT INTO users (username, email, password_hash, photo_url)
             VALUES ($1, $2, NULL, $3)
             RETURNING id`,
            [username, email, typeof claims.picture === "string" ? claims.picture : null],
          );
          userId = created[0].id;
        }

        await client.query(
          `INSERT INTO auth_identities (provider, subject, user_id, email)
           VALUES ('google', $1, $2, $3)
           ON CONFLICT (provider, subject) DO UPDATE SET last_login_at = now()`,
          [claims.sub, userId, email],
        );
      }

      const { rows: userRows } = await client.query(
        `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
        [userId],
      );

      await client.query("COMMIT");

      const user = userRows[0];
      setAuthCookie(res, signToken({ sub: user.id, email: user.email }));
      issueCsrfToken(res);
      res.redirect(frontendUrl("/feed"));
    } catch (error) {
      await client.query("ROLLBACK");
      if (error?.code === "23505") return fail("Já existe uma conta com estes dados");
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
