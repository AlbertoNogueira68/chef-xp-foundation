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

  // Mesma regra para o SMTP, pela mesma razão: com só metade das credenciais,
  // a app oferecia a recuperação de password e o email nunca saía — e quem
  // ficasse à espera dele não tinha como saber porquê.
  //
  // `SMTP_AUTH=none` é a saída para um servidor que não pede credenciais — o
  // Mailpit do compose de desenvolvimento. Aí a regra das duas não se aplica,
  // mas passam a fazer falta duas outras coisas: um host para onde enviar, e
  // um `MAIL_FROM`, porque sem utilizador de SMTP não há nada de onde tirar o
  // remetente.
  if (env.SMTP_AUTH && env.SMTP_AUTH !== "none" && env.SMTP_AUTH !== "login") {
    errors.push('SMTP_AUTH só aceita "login" (por omissão) ou "none"');
  }

  // Quem define credenciais quer usá-las. O compose de desenvolvimento põe
  // SMTP_AUTH=none por omissão para apontar ao Mailpit, e sem esta regra um
  // `.env` com o Gmail lá dentro passava a ser ignorado em silêncio — ou, se
  // isto fosse um erro, deixava de arrancar por causa de um valor que a
  // pessoa nunca escreveu.
  const temCredenciais = Boolean(env.SMTP_USER || env.SMTP_PASSWORD);
  if (env.SMTP_AUTH === "none" && temCredenciais) {
    console.warn(
      "[env] SMTP_AUTH=none ignorado: há SMTP_USER/SMTP_PASSWORD definidas e são elas que valem.",
    );
  }

  if (env.SMTP_AUTH === "none" && !temCredenciais) {
    // Um servidor que aceita correio sem credenciais — o Mailpit do compose,
    // ou um relay na própria máquina. Faltam-lhe duas coisas que as
    // credenciais traziam: para onde enviar, e de quem vem o email.
    if (!env.SMTP_HOST) {
      errors.push("Com SMTP_AUTH=none é preciso SMTP_HOST (para onde enviar o correio)");
    }
    if (!env.MAIL_FROM) {
      errors.push("Com SMTP_AUTH=none é preciso MAIL_FROM: não há SMTP_USER de onde o tirar");
    }
    if (isProd) {
      console.warn(
        "[env] SMTP_AUTH=none em produção: o correio sai sem credenciais e sem TLS. " +
          "Só faz sentido para um relay na própria máquina.",
      );
    }
  } else if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    errors.push("SMTP_USER e SMTP_PASSWORD têm de ser definidas as duas, ou nenhuma");
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
