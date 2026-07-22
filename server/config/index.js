export const config = {
  port: Number(process.env.PORT || 3010),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "dev-only-insecure-jwt-secret-min-32",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173",
};
