const WEAK_SECRETS = new Set([
  "changeme",
  "secret",
  "jwt_secret",
  "your-secret-here",
  "development-secret-change-me-32chars!",
]);

export function validateEnv(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (isProd) {
    const jwtSecret = env.JWT_SECRET || "";
    if (jwtSecret.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters in production");
    }
    if (WEAK_SECRETS.has(jwtSecret.toLowerCase())) {
      throw new Error("JWT_SECRET is too weak for production");
    }
  } else if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) {
    console.warn("[env] JWT_SECRET missing or short; using insecure development default");
  }
}
