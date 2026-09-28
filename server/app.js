import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { validateEnv } from "./lib/validateEnv.js";
import { cspDirectives } from "./lib/cspConfig.js";
import { csrfProtection } from "./middleware/csrf.js";
import { language } from "./middleware/language.js";
import { errorHandler, notFound, requestId } from "./middleware/errorHandler.js";
import { httpLog } from "./middleware/httpLog.js";
import { log } from "./lib/logger.js";
import { getPool } from "./db/index.js";
import { UPLOAD_DIR, UPLOAD_ROUTE } from "./lib/imageStore.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import recipeRoutes from "./routes/recipes.js";
import challengeRoutes from "./routes/challenges.js";
import learningRoutes from "./routes/learning.js";
import missionRoutes from "./routes/missions.js";
import notificationRoutes from "./routes/notifications.js";
import reportRoutes from "./routes/reports.js";
import moderationRoutes from "./routes/moderation.js";
import adminRoutes from "./routes/admin.js";
import leaderboardRoutes from "./routes/leaderboard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const isProd = process.env.NODE_ENV === "production";

/**
 * Constrói a aplicação Express sem a pôr a escutar.
 *
 * A separação existe para os testes de integração: eles precisam da API
 * inteira — CORS, CSRF, limites de tamanho, tratamento de erros — mas numa
 * porta efémera e sem os efeitos de arranque (migrations, sync do currículo),
 * que o harness controla por si.
 */
export function createApp() {
  validateEnv();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestId);
  // Uma linha por pedido, no fim dele. Vem depois do `requestId` para a
  // linha poder levar o id, e antes de tudo o resto para não haver pedido
  // que se resolva sem deixar rasto — incluindo os que uma rota recusa.
  app.use(httpLog);
  app.use(
    helmet({
      contentSecurityPolicy: isProd ? { directives: cspDirectives } : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  /**
   * CORS fechado. Em produção a app é servida pelo mesmo Express que serve a API
   * (same-origin), por isso a lista só existe para o `npm run dev:all`, em que o
   * Vite corre noutra porta. Antes havia aqui um `|| isProd` que abria a API a
   * qualquer origem exatamente onde isso é mais perigoso.
   */
  const allowedOrigins = [process.env.FRONTEND_URL, process.env.CORS_ORIGIN]
    .filter(Boolean)
    .concat(isProd ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"]);

  /**
   * A origem do próprio pedido.
   *
   * "Sem Origin = same-origin" é quase verdade, e o quase custou um ecrã
   * branco: o Vite marca os módulos da build com `crossorigin`, e um módulo
   * com `crossorigin` leva cabeçalho `Origin` **mesmo quando é do mesmo sítio**.
   * Servida pelo próprio Express numa porta que não estivesse na lista — o que
   * o `npm run preview` faz, em :4173, com a lista a apontar para o Vite em
   * :5173 — a aplicação era recusada a si própria: cada `/assets/*.js` dava
   * 500 e a página ficava em branco, sem nada no ecrã a dizer porquê.
   *
   * Comparar com o `Host` do pedido resolve-o sem abrir nada: só é aceite o
   * que vem exactamente do mesmo sítio para onde o pedido foi feito.
   *
   * O protocolo vem do `X-Forwarded-Proto` quando há um proxy à frente (o
   * `trust proxy` está ligado), porque atrás do Caddy o Express vê http e o
   * browser diz https.
   */
  function mesmaOrigem(req) {
    const host = req.headers.host;
    return host ? `${req.protocol}://${host}` : null;
  }

  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      const aceite = !origin || origin === mesmaOrigem(req) || allowedOrigins.includes(origin);

      if (!aceite) return callback(new Error("Origin not allowed by CORS"));
      callback(null, { origin: true, credentials: true });
    }),
  );

  /**
   * O limite é configurável porque uma bateria de testes de integração faz
   * mais pedidos em segundos do que uma pessoa faz em quinze minutos, e
   * apanhar 429 a meio de um teste não diz nada sobre o código.
   *
   * Só na API. Aplicado a tudo, contava cada ficheiro de `/assets`, ícone e
   * manifesto: metade dos 300 de antes ia só em carregar a app. E o limite é
   * por IP, que é partilhado por uma casa inteira ou, nas redes móveis, por
   * muita gente atrás do mesmo CGNAT — dois amigos no mesmo Wi-Fi bastaram
   * para o esgotar. Login, registo e emails têm limites próprios e apertados.
   */
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.RATE_LIMIT_MAX || 1000),
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  /**
   * A publicação de receitas transporta a imagem em base64, por isso precisa de
   * um limite maior. Só essa rota: o resto da API continua em 1 MB.
   * O body-parser marca `req._body`, portanto o parser global a seguir não repete
   * o trabalho.
   */
  app.use("/api/recipes", express.json({ limit: "6mb" }));
  app.use("/api/missions", express.json({ limit: "6mb" }));
  // Criar um desafio leva a imagem de capa pelo mesmo caminho.
  app.use("/api/challenges", express.json({ limit: "6mb" }));
  app.use(express.json({ limit: "1mb" }));

  // A partir daqui, `req.lang` diz em que língua se responde.
  app.use("/api", language);
  app.use("/api", csrfProtection);

  /**
   * Saúde do serviço — e da base, que é a parte que interessa.
   *
   * Isto respondia `{status:"ok"}` sem verificar nada. Um health check que
   * responde ok com o Postgres em baixo é pior do que não haver nenhum: quem
   * vigia o serviço fica a pensar que está de pé, e o restart que o resolveria
   * nunca acontece.
   *
   * O `SELECT 1` tem um limite de tempo próprio: sem ele, uma base a aceitar
   * ligações mas a não responder deixava este pedido pendurado, e um health
   * check que nunca responde é outra maneira de mentir.
   */
  app.get("/api/health", async (_req, res) => {
    try {
      await Promise.race([
        getPool().query("SELECT 1"),
        new Promise((_ok, falhar) =>
          setTimeout(() => falhar(new Error("a base não respondeu em 2s")), 2000).unref(),
        ),
      ]);
      res.json({ status: "ok", db: "ok" });
    } catch (err) {
      log.error({ err }, "health check falhou");
      res.status(503).json({ status: "degraded", db: "down" });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/recipes", recipeRoutes);
  app.use("/api/challenges", challengeRoutes);
  app.use("/api/learning", learningRoutes);
  app.use("/api/missions", missionRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/moderation", moderationRoutes);
  app.use("/api/admin", adminRoutes);

  // Imagens carregadas pelos utilizadores. Nomes são UUID gerados no servidor,
  // por isso o conteúdo é imutável e pode ser cacheado agressivamente.
  app.use(
    UPLOAD_ROUTE,
    express.static(UPLOAD_DIR, {
      maxAge: "365d",
      immutable: true,
      index: false,
      dotfiles: "deny",
    }),
  );

  app.use("/api", notFound);

  /**
   * Servir a build.
   *
   * Em produção é sempre. `SERVE_DIST=true` liga o mesmo sem exigir
   * `NODE_ENV=production`, e existe por uma razão concreta: o service worker
   * só é registado numa build de produção, portanto experimentar a app
   * instalável obrigava a arrancar o servidor em modo de produção — com
   * cookies `Secure` e `__Host-`, que o browser recusa em http://localhost, e
   * com um `JWT_SECRET` que o `validateEnv` exige que não seja o de exemplo.
   * Resultado: quem quisesse ver o modo offline não conseguia sequer entrar.
   * É o que o `npm run preview` usa.
   */
  if (isProd || process.env.SERVE_DIST === "true") {
    const distDir = path.join(rootDir, "dist");
    app.use(
      express.static(distDir, {
        setHeaders(res, filePath) {
          /**
           * O service worker nunca pode ser servido da cache do browser.
           *
           * É ele que decide o que fica guardado; se ele próprio ficasse
           * preso numa versão antiga, um deploy novo não chegava a ninguém
           * que já tivesse aberto a app — e não haveria maneira de corrigir
           * à distância. Os ficheiros de `/assets/` levam o hash no nome e
           * não têm este problema.
           */
          if (path.basename(filePath) === "sw.js") {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
