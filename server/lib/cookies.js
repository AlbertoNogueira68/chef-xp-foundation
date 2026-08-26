/**
 * Nomes e opções de cookies num só sítio.
 *
 * Em produção usamos o prefixo `__Host-`, que o browser só aceita se o cookie
 * for Secure, sem Domain e com Path=/. Isso impede que um subdomínio
 * comprometido escreva por cima do cookie de sessão.
 *
 * COOKIE_SECURE permite desligar explicitamente (ex.: demonstração local em
 * http sobre uma build de produção). Sem a variável, segue o NODE_ENV.
 */
export function useSecureCookies(env = process.env) {
  if (env.COOKIE_SECURE === "true") return true;
  if (env.COOKIE_SECURE === "false") return false;
  return env.NODE_ENV === "production";
}

export function tokenCookieName(env = process.env) {
  return useSecureCookies(env) ? "__Host-token" : "token";
}

export function csrfCookieName(env = process.env) {
  return useSecureCookies(env) ? "__Host-csrf" : "csrf";
}

export function baseCookieOptions(env = process.env) {
  const secure = useSecureCookies(env);
  return {
    secure,
    sameSite: secure ? "strict" : "lax",
    path: "/",
  };
}
