/**
 * Lógica de início de sessão externo que não precisa da rede.
 *
 * Fica separada do `lib/googleOauth.js` — que fala mesmo com a Google — para
 * que as decisões que importam (aceitar ou recusar um token, que nome dar à
 * conta) tenham testes sem depender de um servidor externo.
 */

export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/**
 * Lê o payload de um JWT sem verificar a assinatura.
 *
 * É seguro AQUI e só aqui: este id_token não vem do browser, vem da resposta
 * do endpoint de tokens da Google, obtida pelo servidor por HTTPS e
 * autenticada com o nosso client_secret. A cadeia de confiança é o TLS, não a
 * assinatura. Um id_token que chegasse pelo cliente teria de ser verificado
 * contra as chaves públicas da Google — não é este o caso.
 */
export function decodeJwtPayload(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Valida as alegações do id_token.
 *
 * `email_verified` é a que interessa em termos de segurança: sem ela, quem
 * conseguisse uma conta Google com o email de outra pessoa entrava na conta
 * dela aqui. É por isso que um email não verificado é recusado em vez de
 * criar conta nova — criar conta seria mais simpático e abria a porta a
 * duplicados com o mesmo endereço.
 */
export function validateIdTokenClaims(claims, { clientId, now = Date.now() } = {}) {
  if (!claims || typeof claims !== "object") {
    return { ok: false, reason: "id_token ilegível" };
  }
  if (!GOOGLE_ISSUERS.includes(claims.iss)) {
    return { ok: false, reason: "Emissor inesperado" };
  }
  if (!clientId || claims.aud !== clientId) {
    return { ok: false, reason: "Token emitido para outra aplicação" };
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) {
    return { ok: false, reason: "Token expirado" };
  }
  if (!claims.sub) {
    return { ok: false, reason: "Token sem identificador de utilizador" };
  }
  if (!claims.email) {
    return { ok: false, reason: "A conta Google não partilhou o email" };
  }
  if (claims.email_verified !== true) {
    return { ok: false, reason: "Email da conta Google não verificado" };
  }
  return { ok: true };
}

const USERNAME_MAX = 30;
const USERNAME_MIN = 3;

/**
 * Nome de utilizador a partir do email, dentro das mesmas regras do registo
 * normal (`^[a-z0-9_.]+$`, 3 a 30). O `+tag` do Gmail cai: quem entra com
 * `nome+compras@gmail.com` quer chamar-se `nome`, não `nome+compras`.
 */
export function usernameFromEmail(email) {
  const local = String(email ?? "")
    .toLowerCase()
    .split("@")[0]
    .split("+")[0];

  let candidate = local
    .replace(/[^a-z0-9_.]/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, USERNAME_MAX);

  if (candidate.length < USERNAME_MIN) candidate = `chef${candidate}`;
  return candidate.slice(0, USERNAME_MAX);
}

/**
 * Nome livre a partir de um base e da lista dos que já existem. O sufixo é
 * numérico e o corte é feito no base, para nunca ultrapassar o limite.
 */
export function pickAvailableUsername(base, taken) {
  const used = taken instanceof Set ? taken : new Set(taken ?? []);
  if (!used.has(base)) return base;

  for (let n = 2; n < 1000; n += 1) {
    const suffix = String(n);
    const candidate = base.slice(0, USERNAME_MAX - suffix.length) + suffix;
    if (!used.has(candidate)) return candidate;
  }
  // Praticamente inalcançável, mas melhor um nome feio do que um erro 500.
  return `chef${Date.now()}`.slice(0, USERNAME_MAX);
}
