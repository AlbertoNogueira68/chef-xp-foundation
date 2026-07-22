import "dotenv/config";
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
import { getPool } from "./db/index.js";
import { runMigrations } from "./db/runMigrations.js";
import { csrfProtection } from "./middleware/csrf.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import recipeRoutes from "./routes/recipes.js";
import challengeRoutes from "./routes/challenges.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 3010);

validateEnv();

const app = express();
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: isProd ? { directives: cspDirectives } : false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isProd) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
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

app.use("/api", csrfProtection);
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/challenges", challengeRoutes);

if (isProd) {
  const distDir = path.join(rootDir, "dist");
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

async function boot() {
  getPool();
  await runMigrations();
  app.listen(port, "0.0.0.0", () => {
    console.log(`[server] listening on http://0.0.0.0:${port}`);
  });
}

boot().catch((error) => {
  console.error("[server] failed to start", error);
  process.exit(1);
});
