import crypto from "node:crypto";

/**
 * Regras dos códigos enviados por email.
 *
 * Lógica pura, sem base de dados e sem rede, para as decisões que sustentam a
 * segurança disto — quantos dígitos, quanto tempo, quantas tentativas — terem
 * testes e não ficarem escondidas dentro de uma rota.
 */

export const CODE_LENGTH = 6;

/**
 * Quinze minutos. Tempo que chegue para ir buscar o email no telemóvel, e não
 * tanto que um código esquecido numa caixa de entrada continue a valer no dia
 * seguinte.
 */
export const TTL_MINUTES = { verify: 15, reset: 15 };

/**
 * Seis dígitos são cem mil hipóteses. Sem limite, adivinha-se por tentativa e
 * erro em minutos — o limite é o que transforma o código em segredo.
 */
export const MAX_ATTEMPTS = 5;

/** Não se pede um código novo de segundo a segundo. */
export const RESEND_COOLDOWN_SECONDS = 60;

export const PURPOSES = ["verify", "reset"];

export function isPurpose(value) {
  return PURPOSES.includes(value);
}

/**
 * Um código de seis dígitos com aleatoriedade criptográfica.
 *
 * `randomInt` e não `Math.random()`: o segundo é previsível a partir de umas
 * quantas saídas, e o que aqui se gera dá acesso a uma conta.
 */
export function generateCode() {
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * O que fica gravado.
 *
 * SHA-256 e não bcrypt: ao contrário de uma password, este segredo tem seis
 * dígitos, vida de quinze minutos e cinco tentativas. O que o protege é a
 * janela, não o custo de cada tentativa — e um hash caro aqui só tornaria o
 * login lento. O que importa é que a tabela não guarde o código em claro.
 */
export function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

/** Comparação em tempo constante: um `===` deixa medir o código pelo relógio. */
export function codeMatches(code, hash) {
  const a = Buffer.from(hashCode(code), "utf8");
  const b = Buffer.from(String(hash ?? ""), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function expiryFor(purpose, now = new Date()) {
  const minutes = TTL_MINUTES[purpose] ?? 15;
  return new Date(now.getTime() + minutes * 60_000);
}

/**
 * Um código só serve se existir, não tiver sido usado, não tiver expirado e
 * ainda ter tentativas.
 *
 * Devolve sempre a mesma razão genérica para quem está do lado de fora: dizer
 * "expirou" em vez de "está errado" confirma a quem adivinha que o código
 * existiu. A razão detalhada fica para os registos e para os testes.
 */
export function checkCode(record, code, now = new Date()) {
  if (!record) return { ok: false, reason: "missing" };
  if (record.consumedAt) return { ok: false, reason: "consumed" };
  if (new Date(record.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (Number(record.attempts) >= MAX_ATTEMPTS) return { ok: false, reason: "exhausted" };
  if (!codeMatches(code, record.codeHash)) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

/** Quanto falta para se poder pedir outro código. Zero quando já se pode. */
export function cooldownRemaining(lastCreatedAt, now = new Date()) {
  if (!lastCreatedAt) return 0;
  const elapsed = (now.getTime() - new Date(lastCreatedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}

/**
 * A mensagem que chega a quem tenta.
 *
 * Uma só para todas as recusas. Distingui-las diria a um atacante se o código
 * chegou a existir, se já foi usado ou se ainda vale a pena insistir.
 */
export const GENERIC_FAILURE = "Código inválido ou expirado. Pede um novo.";
