import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { cspDirectives } from "./lib/cspConfig.js";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler, notFound, requestId } from "./middleware/errorHandler.js";
import { UPLOAD_DIR, UPLOAD_ROUTE } from "./lib/imageStore.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import recipeRoutes from "./routes/recipes.js";
import challengeRoutes from "./routes/challenges.js";
import learningRoutes from "./routes/learning.js";
import missionRoutes from "./routes/missions.js";
import feedRoutes from "./routes/feed.js";
import planRoutes from "./routes/plan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

/**
 * Monta a aplicação Express sem a pôr a escutar.
 *
 * A separação existe para os testes de rota: eles precisam do `app` para o
 * levantar numa porta efémera, e não de um servidor que arranca sozinho ao
 * importar o módulo. `server/index.js` continua a ser o ponto de entrada e é
 * quem valida o ambiente, corre as migrations e escuta.
 */
export function createApp({ isProd = process.env.NODE_ENV === "production" } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestId);
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

  app.use(
    cors({
      origin(origin, callback) {
        // Sem Origin = pedido same-origin ou de uma ferramenta local.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origem não permitida por CORS"));
      },
      credentials: true,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
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
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", csrfProtection);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/recipes", recipeRoutes);
  app.use("/api/challenges", challengeRoutes);
  app.use("/api/learning", learningRoutes);
  app.use("/api/missions", missionRoutes);
  app.use("/api/feed", feedRoutes);
  app.use("/api/plan", planRoutes);

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

  if (isProd) {
    const distDir = path.join(rootDir, "dist");
    app.use(express.static(distDir));
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
