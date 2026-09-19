import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { getPool, query } from "../db/index.js";
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from "../middleware/auth.js";
import { clearCsrfToken, issueCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  emailTokenSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  signupCompleteSchema,
  signupStartSchema,
  tokenQuerySchema,
} from "../schemas/index.js";
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
  googlePictureUrl,
  pickAvailableUsername,
  usernameFromEmail,
  validateIdTokenClaims,
} from "../domain/oauth.js";
import { saveRemoteImage } from "../lib/imageStore.js";
import { isMailConfigured, sendMail } from "../lib/mailer.js";
import {
  emailVerificationEmail,
  passwordResetEmail,
  signupEmail,
  signupExistingAccountEmail,
} from "../domain/authEmails.js";
import {
  EMAIL_VERIFICATION,
  PASSWORD_RESET,
  SIGNUP,
  buildLink,
  checkToken,
  expiryFor,
  generateToken,
  hashToken,
} from "../domain/authTokens.js";

const router = Router();

const BCRYPT_ROUNDS = 12;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Função e não valor: estes limitadores são criados quando o módulo é
  // importado, e nessa altura o ambiente do processo de teste ainda não está
  // montado. Lido a cada pedido, o limite é sempre o atual.
  max: () => Number(process.env.RATE_LIMIT_AUTH_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas tentativas de login. Tenta daqui a uns minutos." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  // Como o limite global: uma bateria de testes cria mais contas numa
  // execução do que um dispositivo real cria num ano.
  max: () => Number(process.env.RATE_LIMIT_AUTH_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados registos a partir deste dispositivo." },
});

const USER_COLUMNS = `id, username, email, photo_url, level, xp, time_zone, daily_xp_goal, email_verified_at, role, created_at, updated_at`;

router.get("/csrf", (_req, res) => {
  res.json({ csrfToken: issueCsrfToken(res) });
});

/**
 * Registo de uma vez só — nome, email e password no mesmo formulário.
 *
 * Só existe quando não há email configurado. Havendo, criar conta passa pelo
 * endereço confirmado (`/signup`), e deixar esta porta aberta ao lado era
 * manter uma maneira de criar contas sem confirmar nada — bastava falar com a
 * API em vez de usar o formulário.
 */
router.post(
  "/register",
  registerLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    if (isMailConfigured()) {
      return res.status(404).json({
        error: "Criar conta é por email confirmado. Pede o link em /signup.",
      });
    }

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
    const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [req.user.id]);
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
  // `passwordRecovery` sai daqui e não de uma constante do frontend: sem SMTP
  // configurado, o ecrã de entrada não deve oferecer um link que só levava a
  // um formulário que nunca enviava nada.
  // `signupFlow` diz qual dos dois registos está de pé: com email a funcionar,
  // o endereço é confirmado antes de a conta existir; sem ele, não havendo
  // como confirmar seja o que for, fica o formulário de uma vez só.
  res.json({
    google: isGoogleConfigured(),
    passwordRecovery: isMailConfigured(),
    signupFlow: isMailConfigured() ? "verified" : "direct",
  });
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
 * Traz a fotografia de perfil da Google para dentro de casa.
 *
 * Descarrega uma vez e grava em `/uploads`, como qualquer outra imagem desta
 * app. Guardar o endereço da Google era mais fácil e estava errado de três
 * maneiras: a CSP de produção bloqueia-o (`imgSrc` é `'self'`), punha o
 * browser de quem vê o feed a pedir imagens à Google, e esses endereços
 * mudam — a fotografia acabava por desaparecer sozinha.
 *
 * Só preenche quem não tem fotografia nenhuma. Quem escolheu a sua não a vê
 * ser substituída por aquela que tem na Google a cada início de sessão.
 *
 * Falhar aqui não impede ninguém de entrar: uma conta sem fotografia é uma
 * conta, um início de sessão que rebenta porque a Google demorou não é nada.
 */
async function adotarFotografiaDaGoogle(user, picture) {
  if (user.photo_url) return;

  const origem = googlePictureUrl(picture);
  if (!origem) return;

  try {
    const caminho = await saveRemoteImage(origem, {
      hosts: ["googleusercontent.com"],
      timeoutMs: 4000,
    });
    await query(`UPDATE users SET photo_url = $1, updated_at = now() WHERE id = $2`, [
      caminho,
      user.id,
    ]);
    user.photo_url = caminho;
  } catch (error) {
    console.warn("[oauth] fotografia da Google não ficou guardada:", error.message);
  }
}

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
        //    E só se a conta local também tiver o email confirmado. Sem SMTP,
        //    o `/register` cria contas sem confirmar nada: qualquer pessoa
        //    podia registar o email de outra, esperar que ela entrasse com a
        //    Google e ficar com uma password para a conta dela.
        const { rows: existing } = await client.query(
          `SELECT id, email_verified_at FROM users WHERE email = $1`,
          [email],
        );

        if (existing[0] && !existing[0].email_verified_at) {
          await client.query("ROLLBACK");
          return fail(
            "Já existe uma conta com este email, ainda por confirmar. Entra com a password.",
          );
        }

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

          // Sem fotografia nesta altura: ela é descarregada e gravada depois
          // da transação, para não haver um pedido à rede a segurar uma
          // ligação à base de dados.
          // Nasce com o email confirmado: a Google já o verificou, e sem
          // isso `validateIdTokenClaims` nem tinha deixado chegar aqui.
          const { rows: created } = await client.query(
            `INSERT INTO users (username, email, password_hash, email_verified_at)
             VALUES ($1, $2, NULL, now())
             RETURNING id`,
            [username, email],
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

      // Contas criadas antes de isto ser registado, e contas locais já
      // confirmadas que só agora se ligam: a Google verificou este endereço,
      // por isso fica confirmado. Só se for ainda o email da conta — quem
      // mudou de endereço não confirma o novo com a prova do antigo.
      await client.query(
        `UPDATE users SET email_verified_at = now()
          WHERE id = $1 AND lower(email) = $2 AND email_verified_at IS NULL`,
        [userId, email],
      );

      const { rows: userRows } = await client.query(
        `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
        [userId],
      );

      await client.query("COMMIT");

      const user = userRows[0];
      await adotarFotografiaDaGoogle(user, claims.picture);

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

/* ------------------------------------------------------------------ */
/* Recuperação de password e verificação de email                     */
/* ------------------------------------------------------------------ */

/**
 * Mais apertado do que o do login, e pelo motivo oposto.
 *
 * No login o custo de abusar é do atacante. Aqui o custo é de terceiros: cada
 * pedido manda um email a alguém que não o pediu, e uma caixa de correio
 * inundada a partir do nosso domínio é o caminho mais curto para o servidor
 * de email ser marcado como spam.
 */
const mailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: () => Number(process.env.RATE_LIMIT_MAIL_MAX || process.env.RATE_LIMIT_AUTH_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados pedidos de email. Tenta daqui a uma hora." },
});

/** Emite um token novo e deita fora os anteriores do mesmo tipo. */
async function issueToken({ kind, userId, email }) {
  const { token, tokenHash } = generateToken();

  // Pedir um link novo invalida o antigo. Se assim não fosse, cada pedido
  // deixava mais uma chave válida a circular numa caixa de correio.
  await query(`DELETE FROM auth_tokens WHERE user_id = $1 AND kind = $2`, [userId, kind]);
  await query(
    `INSERT INTO auth_tokens (token_hash, kind, user_id, email, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenHash, kind, userId, email, expiryFor(kind)],
  );

  return token;
}

/* ------------------------------------------------------------------ */
/* Criar conta: o email é confirmado antes de a conta existir         */
/* ------------------------------------------------------------------ */

/**
 * Primeiro passo: escreve-se o endereço e sai um link.
 *
 * Nada é criado aqui. Enquanto o link não for aberto só existe uma linha em
 * `pending_signups` — sem nome de utilizador tomado, sem conta a ocupar o
 * email de ninguém.
 *
 * Responde sempre o mesmo, esteja o endereço livre ou já registado. É a regra
 * que o `/forgot-password` já seguia, e agora vale mesmo a pena: o registo
 * antigo respondia 409 a um email em uso, portanto quem quisesse saber quem
 * tem conta aqui bastava-lhe perguntar. Quem for dono da caixa recebe um email
 * a explicar; quem estiver a sondar fica sem saber nada.
 */
router.post(
  "/signup",
  registerLimiter,
  mailLimiter,
  validate({ body: signupStartSchema }),
  asyncHandler(async (req, res) => {
    if (!isMailConfigured()) {
      return res.status(404).json({ error: "Criar conta por email não está configurado" });
    }

    const { email } = req.valid.body;

    const { rows } = await query(`SELECT id, username FROM users WHERE email = $1`, [email]);
    const existente = rows[0];

    try {
      if (existente) {
        await sendMail({
          to: email,
          ...signupExistingAccountEmail({
            username: existente.username,
            link: frontendUrl("/forgot-password"),
          }),
        });
      } else {
        const { token, tokenHash } = generateToken();

        // Pedir o link outra vez substitui o anterior, como em `issueToken`:
        // senão cada tentativa deixava mais uma chave válida na caixa.
        await query(
          `INSERT INTO pending_signups (token_hash, email, expires_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE
              SET token_hash = EXCLUDED.token_hash,
                  expires_at = EXCLUDED.expires_at,
                  created_at = now()`,
          [tokenHash, email, expiryFor(SIGNUP)],
        );

        await sendMail({
          to: email,
          ...signupEmail({ link: buildLink(process.env.FRONTEND_URL, "/criar-conta", token) }),
        });
      }
    } catch (error) {
      // Como na recuperação: um SMTP em baixo não pode dar uma resposta
      // diferente da de um email já registado, senão a resposta volta a
      // dizer quem tem conta.
      console.error("[mail] link de criação de conta não saiu:", error.message);
    }

    res.json({ ok: true });
  }),
);

/**
 * O que o formulário do segundo passo precisa de saber antes de se desenhar:
 * este link ainda vale, e para que endereço é.
 *
 * Devolver o email não conta nada a quem trouxe o token — ele veio da caixa
 * de correio desse mesmo endereço — e evita que alguém escolha nome e
 * password para depois ouvir que o link já tinha expirado.
 */
router.get(
  "/signup",
  validate({ query: tokenQuerySchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT token_hash, email, expires_at FROM pending_signups WHERE token_hash = $1`,
      [hashToken(req.valid.query.token)],
    );

    const check = checkToken(rows[0]);
    if (!check.ok) {
      return res.status(400).json({ error: "Link inválido ou expirado. Pede outro." });
    }

    res.json({ email: check.email });
  }),
);

/**
 * Segundo passo: com o link aberto, escolhe-se o nome e a password.
 *
 * É aqui que a conta nasce, e nasce com o email já confirmado — quem chegou
 * aqui leu aquela caixa de correio.
 *
 * Um nome de utilizador já tomado devolve 409 e deixa o link intacto: a
 * transação faz ROLLBACK e a pessoa tenta outro nome sem ter de pedir email
 * nenhum. Só um registo completo é que gasta o token.
 */
router.post(
  "/signup/complete",
  registerLimiter,
  validate({ body: signupCompleteSchema }),
  asyncHandler(async (req, res) => {
    const { token, username, password } = req.valid.body;
    const tokenHash = hashToken(token);
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      // FOR UPDATE: dois pedidos com o mesmo token esperam um pelo outro, e o
      // segundo encontra a linha já apagada.
      const { rows } = await client.query(
        `SELECT token_hash, email, expires_at FROM pending_signups
          WHERE token_hash = $1 FOR UPDATE`,
        [tokenHash],
      );

      const check = checkToken(rows[0]);
      if (!check.ok) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Link inválido ou expirado. Pede outro." });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      let user;
      try {
        const criado = await client.query(
          `INSERT INTO users (username, email, password_hash, email_verified_at)
           VALUES ($1, $2, $3, now())
           RETURNING ${USER_COLUMNS}`,
          [username, check.email, passwordHash],
        );
        user = criado.rows[0];
      } catch (error) {
        await client.query("ROLLBACK");
        if (error?.code === "23505") {
          // Pode ser o nome (tenta outro) ou o email (a conta apareceu entre
          // o pedido do link e este momento). A mensagem cobre os dois sem
          // dizer qual, que é o que a resposta do `/signup` também faz.
          return res.status(409).json({ error: "Esse nome de utilizador já está em uso" });
        }
        throw error;
      }

      await client.query(`DELETE FROM pending_signups WHERE token_hash = $1`, [tokenHash]);
      await client.query("COMMIT");

      setAuthCookie(res, signToken({ sub: user.id, email: user.email }));
      issueCsrfToken(res);

      res.status(201).json({
        user: toPublicUser(user, { includeEmail: true }),
        needsEmailConfirmation: false,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

/**
 * Pedir um link de recuperação.
 *
 * Responde sempre o mesmo, exista ou não a conta. Não porque isso esconda
 * grande coisa — o registo já responde 409 para um email em uso, portanto
 * quem quiser saber se um endereço está registado descobre-o por lá — mas
 * porque a alternativa era dizer "não existe conta com esse email" a quem
 * escreveu o endereço errado, e essa pessoa passaria a tarde a tentar.
 */
router.post(
  "/forgot-password",
  mailLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    if (!isMailConfigured()) {
      return res.status(404).json({ error: "Recuperação de password não está configurada" });
    }

    const { email } = req.valid.body;
    const { rows } = await query(
      `SELECT id, username, email, password_hash FROM users WHERE email = $1`,
      [email],
    );
    const user = rows[0];

    // Uma conta de SSO não tem password para redefinir. Não recebe email
    // nenhum: dar-lhe um link que a deixasse criar uma password era abrir
    // uma segunda porta para uma conta que só tinha a da Google.
    if (user && user.password_hash !== null) {
      const token = await issueToken({
        kind: PASSWORD_RESET,
        userId: user.id,
        email: user.email,
      });

      try {
        await sendMail({
          to: user.email,
          ...passwordResetEmail({
            username: user.username,
            link: buildLink(process.env.FRONTEND_URL, "/reset-password", token),
          }),
        });
      } catch (error) {
        // O erro fica no registo do servidor e não na resposta: se um SMTP em
        // baixo desse 500 e um email inexistente desse 200, a resposta passava
        // a dizer quem tem conta.
        console.error("[mail] recuperação de password não saiu:", error.message);
      }
    }

    res.json({ ok: true });
  }),
);

/**
 * Redefinir com o token que veio no email.
 *
 * Não inicia sessão no fim. Quem redefine a password acabou de provar que lê
 * aquela caixa de correio, não que é a pessoa — e o passo seguinte, entrar com
 * a password nova, custa cinco segundos e fecha essa diferença.
 */
router.post(
  "/reset-password",
  mailLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    const tokenHash = hashToken(req.valid.body.token);
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      // FOR UPDATE: dois pedidos com o mesmo token esperam um pelo outro, e o
      // segundo encontra-o já gasto. Sem o bloqueio, os dois liam-no válido.
      const { rows } = await client.query(
        `SELECT token_hash, kind, user_id, email, expires_at, used_at
           FROM auth_tokens WHERE token_hash = $1 FOR UPDATE`,
        [tokenHash],
      );

      const check = checkToken(rows[0], { kind: PASSWORD_RESET });
      if (!check.ok) {
        await client.query("ROLLBACK");
        // A mesma resposta para inexistente, expirado e já usado: distingui-los
        // era deixar tentar até acertar num que existisse.
        return res.status(400).json({ error: "Link inválido ou expirado. Pede outro." });
      }

      const passwordHash = await bcrypt.hash(req.valid.body.password, BCRYPT_ROUNDS);

      // Quem chegou aqui leu o email: o endereço fica confirmado de caminho.
      // `COALESCE` para não apagar a data de uma confirmação anterior.
      await client.query(
        `UPDATE users
            SET password_hash = $1,
                email_verified_at = COALESCE(email_verified_at, now()),
                updated_at = now()
          WHERE id = $2`,
        [passwordHash, check.userId],
      );

      await client.query(`DELETE FROM auth_tokens WHERE user_id = $1 AND kind = $2`, [
        check.userId,
        PASSWORD_RESET,
      ]);

      await client.query("COMMIT");

      // Nota: as sessões abertas noutros dispositivos continuam válidas até o
      // JWT expirar. Fechá-las exigiria uma lista de tokens revogados ou um
      // contador de versão por utilizador — vale a pena, mas é outra decisão,
      // e não fica escondida aqui dentro.
      res.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

/** Pedir (ou repetir) o email de confirmação da própria conta. */
router.post(
  "/verify-email/send",
  requireAuth,
  mailLimiter,
  asyncHandler(async (req, res) => {
    if (!isMailConfigured()) {
      return res.status(404).json({ error: "Verificação de email não está configurada" });
    }

    const { rows } = await query(
      `SELECT id, username, email, email_verified_at FROM users WHERE id = $1`,
      [req.user.id],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.email_verified_at) {
      return res.status(409).json({ error: "Este email já está confirmado" });
    }

    const token = await issueToken({
      kind: EMAIL_VERIFICATION,
      userId: user.id,
      email: user.email,
    });

    try {
      await sendMail({
        to: user.email,
        ...emailVerificationEmail({
          username: user.username,
          link: buildLink(process.env.FRONTEND_URL, "/verify-email", token),
        }),
      });
    } catch (error) {
      // Aqui, ao contrário da recuperação, quem pediu está autenticado e sabe
      // que o pediu: esconder a falha só o deixava à espera de um email que
      // nunca chegaria.
      console.error("[mail] verificação de email não saiu:", error.message);
      return res.status(502).json({ error: "Não foi possível enviar o email. Tenta mais tarde." });
    }

    res.json({ ok: true });
  }),
);

/**
 * Confirmar com o token do email.
 *
 * Sem sessão: o token é a prova, e exigir login por cima dele obrigava quem
 * abrisse o email noutro dispositivo a entrar primeiro.
 */
router.post(
  "/verify-email",
  validate({ body: emailTokenSchema }),
  asyncHandler(async (req, res) => {
    const tokenHash = hashToken(req.valid.body.token);
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT token_hash, kind, user_id, email, expires_at, used_at
           FROM auth_tokens WHERE token_hash = $1 FOR UPDATE`,
        [tokenHash],
      );
      const row = rows[0];

      const check = checkToken(row, { kind: EMAIL_VERIFICATION });

      if (!check.ok) {
        // Abrir o mesmo link duas vezes é normal: o React monta o ecrã duas
        // vezes em desenvolvimento, e há clientes de email que seguem os links
        // por si. Se o token já foi usado e o email está mesmo confirmado, a
        // resposta é "está confirmado" e não um erro que a pessoa não percebe.
        if (row && check.reason === "já usado") {
          const { rows: done } = await client.query(
            `SELECT 1 FROM users WHERE id = $1 AND email = $2 AND email_verified_at IS NOT NULL`,
            [row.user_id, row.email],
          );
          if (done[0]) {
            await client.query("COMMIT");
            return res.json({ ok: true, alreadyVerified: true });
          }
        }

        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Link inválido ou expirado. Pede outro." });
      }

      // O email tem de ser ainda o da conta. Quem mudou de endereço depois de
      // pedir o link não confirma o novo com o token do antigo.
      const { rows: updated } = await client.query(
        `UPDATE users
            SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
          WHERE id = $1 AND email = $2
        RETURNING id`,
        [check.userId, check.email],
      );

      if (!updated[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Link inválido ou expirado. Pede outro." });
      }

      await client.query(`UPDATE auth_tokens SET used_at = now() WHERE token_hash = $1`, [
        tokenHash,
      ]);

      await client.query("COMMIT");
      res.json({ ok: true, alreadyVerified: false });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
