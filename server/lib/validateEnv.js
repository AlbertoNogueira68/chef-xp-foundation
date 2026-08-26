const WEAK_SECRETS = new Set([
  "changeme",
  "secret",
  "jwt_secret",
  "your-secret-here",
  "development-secret-change-me-32chars!",
  "dev-only-insecure-jwt-secret-min-32-chars",
  "dev-only-insecure-jwt-secret-min-32",
]);

export const MIN_SECRET_LENGTH = 32;

/**
 * Falha no arranque em vez de arrancar mal configurado.
 * Um servidor que assina tokens com um segredo público é pior do que um
 * servidor que não arranca.
 */
export function validateEnv(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";
  const errors = [];

  if (!env.DATABASE_URL) {
    errors.push("DATABASE_URL é obrigatória");
  }

  const jwtSecret = env.JWT_SECRET || "";
  if (!jwtSecret) {
    errors.push("JWT_SECRET é obrigatória (gera uma com: openssl rand -hex 32)");
  } else if (jwtSecret.length < MIN_SECRET_LENGTH) {
    errors.push(`JWT_SECRET tem de ter pelo menos ${MIN_SECRET_LENGTH} caracteres`);
  } else if (isProd && WEAK_SECRETS.has(jwtSecret.toLowerCase())) {
    errors.push("JWT_SECRET é um valor de exemplo conhecido — gera um segredo novo");
  }

  if (isProd) {
    if (!env.FRONTEND_URL && !env.CORS_ORIGIN) {
      errors.push("Em produção define FRONTEND_URL (ou CORS_ORIGIN) para fechar o CORS");
    }
    if (env.COOKIE_SECURE === "false") {
      console.warn(
        "[env] COOKIE_SECURE=false em produção: os cookies de sessão vão viajar em claro.",
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuração inválida:\n  - ${errors.join("\n  - ")}`);
  }
}
