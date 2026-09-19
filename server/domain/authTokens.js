import crypto from "node:crypto";

/**
 * Regras dos tokens que viajam por email.
 *
 * Módulo puro (tirando o gerador de aleatoriedade): não fala com a base de
 * dados nem com o transporte de email. O que aqui está é o que interessa
 * provar sem levantar nada — quanto tempo vale um token, quando é que deixa
 * de valer, e que resposta se dá a cada caso.
 */

export const PASSWORD_RESET = "password_reset";
export const EMAIL_VERIFICATION = "email_verification";
/** O link que se recebe ao escrever o email para criar conta. */
export const SIGNUP = "signup";

/**
 * Uma hora para redefinir a password; um dia para confirmar o email.
 *
 * A diferença é deliberada. O link de recuperação é o que vale mais para quem
 * intercepte a caixa de correio — dá acesso à conta — e por isso vive pouco.
 * O de verificação não dá acesso a nada: só diz "este endereço é mesmo teu", e
 * expirar ao fim de uma hora só serviria para irritar quem lê o email à noite.
 */
export const TTL_MINUTES = {
  [PASSWORD_RESET]: 60,
  [EMAIL_VERIFICATION]: 60 * 24,
  // Um dia, como a verificação: também não dá acesso a nada — do outro lado
  // ainda é preciso escolher nome e password — e quem se inscreve à noite lê
  // o email no dia seguinte.
  [SIGNUP]: 60 * 24,
};

/**
 * 32 bytes de aleatoriedade criptográfica em hexadecimal.
 *
 * Devolve o segredo em claro (que vai no email e mais nenhures) e o SHA-256
 * (que é o que fica na base de dados). SHA-256 e não bcrypt: ao contrário de
 * uma password, isto não é escolhido por uma pessoa nem reutilizado noutro
 * sítio — tem 256 bits de entropia, portanto não há dicionário que o alcance
 * e o custo de cálculo do bcrypt não compraria segurança nenhuma.
 */
export function generateToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function expiryFor(kind, now = new Date()) {
  const minutes = TTL_MINUTES[kind];
  if (!minutes) throw new Error(`Unknown token type: ${kind}`);
  return new Date(now.getTime() + minutes * 60_000);
}

/**
 * Este token serve?
 *
 * `row` é a linha de `auth_tokens` (ou de `pending_signups`, que tem as mesmas
 * colunas que aqui interessam), ou `undefined` se não houver nenhuma. As
 * três razões de recusa são distinguidas aqui porque o servidor quer saber a
 * diferença para os registos — mas a rota diz sempre o mesmo a quem pergunta:
 * um token inválido e um token expirado dão a mesma resposta, senão bastava
 * tentar para descobrir quais os hashes que existem.
 */
export function checkToken(row, { kind, now = new Date() } = {}) {
  if (!row) return { ok: false, reason: "inexistente" };
  if (kind && row.kind !== kind) return { ok: false, reason: "tipo errado" };
  if (row.used_at) return { ok: false, reason: "already used" };
  if (new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, reason: "expirado" };
  return { ok: true, userId: row.user_id, email: row.email };
}

/**
 * Para onde o email aponta.
 *
 * O destino é sempre construído a partir do `FRONTEND_URL` do servidor, nunca
 * de nada que venha no pedido: um link de recuperação que aceitasse o domínio
 * de quem o pede era entregar o token a quem pedisse.
 */
export function buildLink(baseUrl, path, token) {
  const base = String(baseUrl || "http://localhost:5173").replace(/\/$/, "");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}
