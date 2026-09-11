import { smtpConfigError, smtpConfigured } from "./mailer.js";

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

  // Meio configurado é pior do que não configurado: o botão aparecia e o
  // fluxo rebentava a meio, já depois de sair da app.
  const hasGoogleId = Boolean(env.GOOGLE_CLIENT_ID);
  const hasGoogleSecret = Boolean(env.GOOGLE_CLIENT_SECRET);
  if (hasGoogleId !== hasGoogleSecret) {
    errors.push(
      "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET têm de ser definidas as duas, ou nenhuma",
    );
  }

  // Meio configurado é pior do que não configurado, tal como no SSO: o registo
  // prometia um código e o envio rebentava já depois de a pessoa se registar.
  const smtpError = smtpConfigError(env);
  if (smtpError) errors.push(smtpError);

  if (isProd) {
    // Em produção não há consola onde alguém vá buscar o código. Uma conta que
    // não se consegue confirmar, e sem explicação, é pior do que não arrancar.
    if (!smtpConfigured(env)) {
      errors.push(
        "Em produção o SMTP é obrigatório (SMTP_HOST, SMTP_USER, SMTP_PASSWORD): " +
          "sem ele ninguém consegue confirmar a conta nem recuperar a password",
      );
    }
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
