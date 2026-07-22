import crypto from "node:crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString("hex");
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("csrf", token, {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Only enforce for cookie-authenticated mutating requests under /api
  if (!req.cookies?.token) {
    return next();
  }

  const cookieToken = req.cookies?.csrf;
  const headerToken = req.get("X-CSRF-Token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  return next();
}
