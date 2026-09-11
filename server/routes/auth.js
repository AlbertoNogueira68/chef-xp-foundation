import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit, { MemoryStore } from "express-rate-limit";
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
import {
  emailOnlySchema,
  loginSchema,
  passwordChangeSchema,
  passwordResetSchema,
  registerSchema,
  verifyCodeSchema,
} from "../schemas/index.js";
import { GENERIC_FAILURE } from "../domain/accountCodes.js";
import { consumeCode, issueCode } from "../lib/emailCodes.js";
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

/**
 * Os contadores ficam em variáveis próprias para os testes os poderem esvaziar
 * entre casos. Uma suite que regista uma dezena de contas esbarrava no limite e
 * falhava por uma razão que não tem nada a ver com o que está a testar.
 *
 * É a única concessão, e não afrouxa nada: os limites e as janelas são os
 * mesmos em teste e em produção, e o limitador continua a correr em ambos —
 * há um teste que o prova esgotando-o de propósito.
 */
export const loginStore = new MemoryStore();
export const registerStore = new MemoryStore();
export const codeStore = new MemoryStore();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: loginStore,
  message: { error: "Demasiadas tentativas de login. Tenta daqui a uns minutos." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: registerStore,
  message: { error: "Demasiados registos a partir deste dispositivo." },
});

/**
 * O que vai dentro do token.
 *
 * A época da sessão viaja com ele para `requireAuth` a poder comparar: mudar a
 * password incrementa-a e todos os tokens anteriores deixam de valer.
 */
function sessionClaims(user) {
  return { sub: user.id, email: user.email, epoch: Number(user.session_epoch ?? 0) };
}

// `password_hash` vai na lista para o DTO do próprio poder dizer se existe uma
// — uma conta da Google não tem. O valor nunca sai do servidor: `toPublicUser`
// devolve só um booleano.
const USER_COLUMNS = `id, username, email, photo_url, level, xp, time_zone, daily_xp_goal,
  email_verified_at, session_epoch, password_hash, created_at, updated_at`;

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
      setAuthCookie(res, signToken(sessionClaims(user)));
      issueCsrfToken(res);

      // A conta entra logo. O código é para confirmar que o endereço existe,
      // não para deixar alguém à porta — e se o envio falhar, o registo já
      // aconteceu: há um botão para reenviar.
      try {
        await issueCode(user, "verify");
      } catch (error) {
        console.error("[auth] falha ao enviar o código de confirmação:", error.message);
      }

      // O token nunca vai no corpo da resposta, nem em dev: se estivesse
      // acessível ao JavaScript, o cookie HttpOnly não servia de nada.
      res.status(201).json({
        user: toPublicUser(user, { includeEmail: true }),
        needsEmailConfirmation: true,
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
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
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

    setAuthCookie(res, signToken(sessionClaims(user)));
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
          // Entrar pela Google prova o endereço de uma conta local por
          // confirmar — não faz sentido continuar a pedir-lhe o código.
          await client.query(
            `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
              WHERE id = $1`,
            [userId],
          );
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

          // `email_verified` já foi exigido acima: a Google confirmou este
          // endereço, e pedir um código seria pedir a confirmação de uma
          // confirmação.
          const { rows: created } = await client.query(
            `INSERT INTO users (username, email, password_hash, photo_url, email_verified_at)
             VALUES ($1, $2, NULL, $3, now())
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
      setAuthCookie(res, signToken(sessionClaims(user)));
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

/* ------------------------------------------------------------------ */
/* Confirmar a conta                                                  */
/* ------------------------------------------------------------------ */

/**
 * Pedir um código é uma ação barata para quem pede e cara para quem recebe:
 * cada pedido é um email enviado em nome de alguém. O intervalo de um minuto
 * entre códigos está no domínio; isto é a segunda barreira, por dispositivo.
 */
const codeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  store: codeStore,
  message: { error: "Demasiados pedidos de código. Tenta daqui a uns minutos." },
});

router.post(
  "/verify/request",
  codeLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (user.email_verified_at) {
      return res.json({ alreadyVerified: true, sent: false });
    }

    const result = await issueCode(user, "verify");
    if (!result.sent) {
      return res.status(429).json({
        error: `Já foi enviado um código. Espera ${result.retryAfter}s para pedir outro.`,
        retryAfter: result.retryAfter,
      });
    }
    res.json({ sent: true });
  }),
);

router.post(
  "/verify",
  codeLimiter,
  requireAuth,
  validate({ body: verifyCodeSchema }),
  asyncHandler(async (req, res) => {
    const result = await consumeCode(req.user.id, "verify", req.valid.body.code);
    if (!result.ok) return res.status(400).json({ error: GENERIC_FAILURE });

    const { rows } = await query(
      `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
        WHERE id = $1
        RETURNING ${USER_COLUMNS}`,
      [req.user.id],
    );
    res.json({ user: toPublicUser(rows[0], { includeEmail: true }) });
  }),
);

/* ------------------------------------------------------------------ */
/* Recuperar a password                                               */
/* ------------------------------------------------------------------ */

/**
 * Pedir um código de recuperação.
 *
 * Responde sempre o mesmo, exista a conta ou não. Dizer "não há conta com este
 * email" transformava esta rota num verificador de endereços registados — e é
 * exactamente a mesma razão pela qual o login não distingue email inexistente
 * de password errada.
 *
 * Uma conta de SSO sem password também recebe o código: definir a primeira por
 * esta via é legítimo, e recusá-la aqui voltaria a revelar o que existe.
 */
router.post(
  "/password/forgot",
  codeLimiter,
  validate({ body: emailOnlySchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [
      req.valid.body.email,
    ]);

    if (rows[0]) {
      try {
        await issueCode(rows[0], "reset");
      } catch (error) {
        console.error("[auth] falha ao enviar o código de recuperação:", error.message);
      }
    }

    res.json({ sent: true });
  }),
);

/**
 * Definir a password nova com o código.
 *
 * Incrementa a época da sessão: quem tenha entrado na conta é expulso. É o
 * ponto da recuperação — sem isto, mudar a password por se desconfiar de um
 * acesso indevido deixava esse acesso vivo mais uma semana.
 */
router.post(
  "/password/reset",
  codeLimiter,
  validate({ body: passwordResetSchema }),
  asyncHandler(async (req, res) => {
    const { email, code, password } = req.valid.body;

    const { rows } = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    const user = rows[0];

    // A mesma recusa de um código errado: não confirma se o email existe.
    if (!user) return res.status(400).json({ error: GENERIC_FAILURE });

    const result = await consumeCode(user.id, "reset", code);
    if (!result.ok) return res.status(400).json({ error: GENERIC_FAILURE });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await query(
      `UPDATE users
          SET password_hash = $1,
              session_epoch = session_epoch + 1,
              email_verified_at = COALESCE(email_verified_at, now())
        WHERE id = $2`,
      [passwordHash, user.id],
    );

    // Não se inicia sessão aqui: quem recuperou a password entra com ela, e
    // isso confirma que a decorou em vez de a deixar no ecrã anterior.
    clearAuthCookie(res);
    res.json({ ok: true });
  }),
);

/**
 * Mudar a password estando autenticado — ou definir a primeira, no caso de uma
 * conta criada pela Google, que não tem nenhuma.
 */
router.post(
  "/password",
  requireAuth,
  validate({ body: passwordChangeSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [req.user.id],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Quem já tem password prova que a sabe. Sem isto, um computador deixado
    // aberto era suficiente para trancar o dono fora da própria conta.
    if (user.password_hash !== null) {
      const current = req.valid.body.currentPassword ?? "";
      const ok = current ? await bcrypt.compare(current, user.password_hash) : false;
      if (!ok) return res.status(403).json({ error: "A password actual não confere" });
    }

    const passwordHash = await bcrypt.hash(req.valid.body.password, BCRYPT_ROUNDS);
    const { rows: updated } = await query(
      `UPDATE users SET password_hash = $1, session_epoch = session_epoch + 1
        WHERE id = $2
        RETURNING ${USER_COLUMNS}`,
      [passwordHash, req.user.id],
    );

    // A época subiu e invalidou todos os tokens, incluindo o desta sessão.
    // Quem está a mudar a password de propósito não deve ser expulso por isso:
    // sai um cookie novo, e só as outras sessões caem.
    setAuthCookie(res, signToken(sessionClaims(updated[0])));
    res.json({ user: toPublicUser(updated[0], { includeEmail: true }) });
  }),
);

export default router;
